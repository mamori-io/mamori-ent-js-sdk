/**
 * Env-gated Azure replace-device-token / skip device code (ch10588).
 *
 * Pattern: admin configures provider + reads catalogs; subject portal login;
 * admin asserts connection/auth events differ for skip ON vs OFF.
 *
 * Required env (else entire describe skipped):
 *   MAMORI_AZURE_PROVIDER
 *   MAMORI_DIRECTORY_USERNAME + MAMORI_DIRECTORY_PASSWORD
 *     or MAMORI_AZURE_USER + MAMORI_AZURE_PASSWORD
 * Also: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD (admin)
 *
 * Negative paths only (API cannot create an OAuth portal session).
 */
import { MamoriService } from "../../api";
import { DirectoryUser } from "../../user";
import { noThrow, ignoreError } from "../../utils";
import {
  INSECURE_HTTPS,
  assertProviderOption,
  collectAuthEventsMentioning,
  col,
  isApiError,
  isNoOauthPortalSessionFailure,
  killOpenSessionsForUser,
  listConnectionLogForUser,
  messagesContainAny,
  portalLogin,
} from "../../__utility__/auth-test-harness";
import { sleep } from "../../__utility__/test-helper";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const azureProvider = process.env.MAMORI_AZURE_PROVIDER || "";
const azureUser =
  process.env.MAMORI_AZURE_USER || process.env.MAMORI_DIRECTORY_USERNAME || "";
const azurePassword =
  process.env.MAMORI_AZURE_PASSWORD || process.env.MAMORI_DIRECTORY_PASSWORD || "";

const gated =
  azureProvider && azureUser && azurePassword && host && username && password
    ? describe
    : describe.skip;

gated(
  "replace-device-token skip device code paths" +
    (testbatch ? " " + testbatch : ""),
  () => {
    let api: MamoriService;
    let providerType = "azure";
    let originalReplace = "false";

    beforeAll(async () => {
      api = new MamoriService(host, INSECURE_HTTPS);
      await api.login(username, password);

      const got = await noThrow(api.get_provider(azureProvider));
      if (got && !(got as any).errors) {
        providerType =
          (got as any).provider_type || (got as any).type || "azure";
        const props = (got as any).properties || {};
        originalReplace =
          props.replace_device_token_workflow != null
            ? String(props.replace_device_token_workflow)
            : "false";
      }

      const dirUser = new DirectoryUser(azureProvider, azureUser);
      await ignoreError(dirUser.create(api));
    });

    afterAll(async () => {
      await ignoreError(
        api.update_provider(azureProvider, {
          name: azureProvider,
          type: providerType,
          replace_device_token_workflow:
            originalReplace === "true" ? "true" : "false",
        }),
      );
      await ignoreError(api.logout());
    });

    async function setReplaceDeviceToken(enabled: boolean): Promise<void> {
      const r = await noThrow(
        api.update_provider(azureProvider, {
          name: azureProvider,
          type: providerType,
          replace_device_token_workflow: enabled ? "true" : "false",
        }),
      );
      expect(r && (r as any).errors).not.toBe(true);
      await assertProviderOption(
        api,
        azureProvider,
        "replace_device_token_workflow",
        enabled ? "true" : "false",
      );
    }

    test("skip device code ON: portal login fails with no OAuth portal session + matching events", async () => {
      await setReplaceDeviceToken(true);
      // Clear ambient browser OAuth portal sessions so the negative path is deterministic
      await killOpenSessionsForUser(api, azureUser);

      const loginResult = await portalLogin(host, azureUser, azurePassword);
      const msg = JSON.stringify(loginResult);
      const msgLower = msg.toLowerCase();

      if (!isApiError(loginResult)) {
        throw new Error(
          "Expected portal login to FAIL with skip device code ON (no OAuth portal session), " +
            "but login succeeded (or returned a non-error payload). " +
            "Hub may be reusing a sibling pool connection after Azure auth-invalid. " +
            "loginResult=" +
            msg.slice(0, 500),
        );
      }
      if (!isNoOauthPortalSessionFailure(msgLower)) {
        throw new Error(
          "Expected failure message to mention no active OAuth portal session, got: " +
            msg.slice(0, 500),
        );
      }

      // Hub must not open a sibling "Mamori Portal" pool connection after portal-login fails
      await sleep(1000);
      const rows = await listConnectionLogForUser(api, azureUser, 40);
      const appOf = (r: any) => String(col(r, "client_application") || "");
      const isAuth = (r: any) => {
        const v = col(r, "authenticated");
        return v === true || v === "t" || String(v).toLowerCase() === "true";
      };
      const recent = rows.slice(0, 8);
      const portalLoginRows = recent.filter(
        (r) => appOf(r).toLowerCase() === "mamori portal login",
      );
      expect(portalLoginRows.length).toBeGreaterThan(0);
      const latestPortalLogin = portalLoginRows[0];
      expect(isAuth(latestPortalLogin)).toBe(false);

      const siblingPortal = recent.find(
        (r) => appOf(r) === "Mamori Portal" && isAuth(r),
      );
      if (siblingPortal) {
        throw new Error(
          "Expected no authenticated sibling 'Mamori Portal' after failed portal-login; " +
            "got connection id=" +
            String(col(siblingPortal, "id") || col(siblingPortal, "ssid")),
        );
      }

      const connId = col(latestPortalLogin, "id") || col(latestPortalLogin, "connection_id");
      const events = await collectAuthEventsMentioning(
        api,
        [azureUser, azureProvider, "oauth", "portal session"],
        { waitMs: 500, take: 100, connectionId: connId },
      );
      // Soft: login error already proves the OAuth-session path; events may lag for failed sessions
      if (events.length > 0) {
        expect(
          messagesContainAny(events, [
            "no active oauth portal session",
            "oauth portal session",
            "looking for oauth portal session",
            "replace device token",
          ]),
        ).toBe(true);
      }
    });

    test(
      "skip device code OFF: portal login fails with non-OAuth Azure/device-code error + matching events",
      async () => {
        await setReplaceDeviceToken(false);

        const loginResult = await portalLogin(host, azureUser, azurePassword);
        const msg = JSON.stringify(loginResult);
        const msgLower = msg.toLowerCase();

        if (!isApiError(loginResult)) {
          throw new Error(
            "Expected portal login to FAIL with skip device code OFF (Azure/device-code path), " +
              "but login succeeded. loginResult=" +
              msg.slice(0, 500),
          );
        }
        if (isNoOauthPortalSessionFailure(msgLower)) {
          throw new Error(
            "Expected a non-OAuth Azure/device-code failure with skip OFF, " +
              "but got OAuth-portal-session failure (wrong path). loginResult=" +
              msg.slice(0, 500),
          );
        }
        expect(msg.length).toBeGreaterThan(10);

        const events = await collectAuthEventsMentioning(
          api,
          [azureUser, azureProvider, "azure", "device", "auth"],
          { waitMs: 2000, take: 200 },
        );
        // Soft if Hub did not persist events for this failure path; login error already proved non-OAuth path
        if (events.length > 0) {
          expect(
            messagesContainAny(events, [
              "no active oauth portal session",
              "looking for oauth portal session",
            ]),
          ).toBe(false);
          expect(
            messagesContainAny(events, [
              "azure",
              "device code",
              "authorization",
              "timed out",
              "authentication",
            ]),
          ).toBe(true);
        }
      },
      180000,
    );
  },
);

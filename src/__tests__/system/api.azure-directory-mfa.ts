/**
 * Azure replace-device-token MFA (ch10588) — admin only, no subject login.
 *
 * For replace true then false:
 *   set provider flag → add directory user → ENROLL_DIRECTORY_MFA_IF_NEEDED →
 *   count pushtotp rows in SYS.USER_AUTHENTICATION_PROVIDERS → drop user.
 * Expect count > 0 when replace is true, else 0. Restore provider at end.
 *
 * Env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD
 * Optional: MAMORI_AZURE_USER, MAMORI_AZURE_PROVIDER
 */
import { MamoriService } from "../../api";
import { DirectoryUser, MFA_PROVIDER } from "../../user";
import { noThrow, ignoreError } from "../../utils";
import {
  INSECURE_HTTPS,
  assertOperationOk,
  directoryUserRows,
  findAzureDirectoryProvider,
  isApiError,
} from "../../__utility__/auth-test-harness";
import { selectQuery, sleep } from "../../__utility__/test-helper";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const preferredAzureProvider = process.env.MAMORI_AZURE_PROVIDER || "";
const azureUser =
  process.env.MAMORI_AZURE_USER || "testuser@omarmamori.onmicrosoft.com";

const PROVIDER_RELOAD_MS = 5000;

type ProviderSnapshot = {
  replace_device_token_workflow: string;
  mfa_provider: string;
  portal_local_auth_mfa: string;
  resource_access_mfa: string;
};

const gated =
  host && username && password && azureUser ? describe : describe.skip;

gated(
  "azure directory MFA by replace_device_token_workflow" +
    (testbatch ? " " + testbatch : ""),
  () => {
    let api: MamoriService;
    let azureName = "";
    let azureType = "azure";
    let original: ProviderSnapshot = {
      replace_device_token_workflow: "false",
      mfa_provider: "",
      portal_local_auth_mfa: "",
      resource_access_mfa: "",
    };

    function optString(props: any, key: string, fallback: string = ""): string {
      if (props == null || props[key] == null) {
        return fallback;
      }
      return String(props[key]);
    }

    async function updateAzureOptions(opts: {
      replace_device_token_workflow: string;
      mfa_provider?: string;
      portal_local_auth_mfa?: string;
      resource_access_mfa?: string;
    }): Promise<void> {
      const body: any = {
        name: azureName,
        type: azureType,
        replace_device_token_workflow: opts.replace_device_token_workflow,
      };
      if (opts.mfa_provider !== undefined) {
        body.mfa_provider = opts.mfa_provider;
      }
      if (opts.portal_local_auth_mfa !== undefined) {
        body.portal_local_auth_mfa = opts.portal_local_auth_mfa;
      }
      if (opts.resource_access_mfa !== undefined) {
        body.resource_access_mfa = opts.resource_access_mfa;
      }
      const r = await noThrow(api.update_provider(azureName, body));
      expect(r && (r as any).errors).not.toBe(true);
      await sleep(PROVIDER_RELOAD_MS);
    }

    async function restoreOriginal(): Promise<void> {
      if (!azureName) {
        return;
      }
      await ignoreError(
        api.update_provider(azureName, {
          name: azureName,
          type: azureType,
          replace_device_token_workflow: original.replace_device_token_workflow,
          mfa_provider: original.mfa_provider,
          portal_local_auth_mfa: original.portal_local_auth_mfa,
          resource_access_mfa: original.resource_access_mfa,
        }),
      );
    }

    async function dropDirectoryUser(): Promise<void> {
      const dirUser = new DirectoryUser(azureName, azureUser);
      await ignoreError(dirUser.delete(api));
    }

    async function addDirectoryUser(): Promise<void> {
      const dirUser = new DirectoryUser(azureName, azureUser);
      await ignoreError(dirUser.delete(api));
      assertOperationOk(
        "directory user create",
        await noThrow(dirUser.create(api)),
      );
      const rows = await directoryUserRows(api, azureUser);
      expect(rows.length).toBeGreaterThan(0);
    }

    async function enrollDirectoryMfaIfNeeded(): Promise<void> {
      const r = await noThrow(
        api.call("ENROLL_DIRECTORY_MFA_IF_NEEDED", azureUser, azureName),
      );
      if (isApiError(r)) {
        throw new Error(
          "ENROLL_DIRECTORY_MFA_IF_NEEDED failed: " + JSON.stringify(r),
        );
      }
    }

    /** Count pushtotp rows for the subject in SYS.USER_AUTHENTICATION_PROVIDERS. */
    async function countPushTotpRows(): Promise<number> {
      const escaped = azureUser.replace(/'/g, "''");
      const rows = await selectQuery(
        api,
        "SELECT * FROM SYS.USER_AUTHENTICATION_PROVIDERS" +
          " WHERE lower(user_name) = lower('" +
          escaped +
          "')" +
          " AND lower(provider_name) = 'pushtotp'",
      );
      if (rows && rows.errors) {
        throw new Error(
          "SYS.USER_AUTHENTICATION_PROVIDERS query failed: " +
            JSON.stringify(rows),
        );
      }
      return Array.isArray(rows) ? rows.length : 0;
    }

    beforeAll(async () => {
      api = new MamoriService(host, INSECURE_HTTPS);
      await api.login(username, password);

      const azure = await findAzureDirectoryProvider(api, preferredAzureProvider);
      azureName = azure.name;
      azureType = azure.type;
      const props = azure.properties || {};
      original = {
        replace_device_token_workflow: optString(
          props,
          "replace_device_token_workflow",
          "false",
        ),
        mfa_provider: optString(props, "mfa_provider", ""),
        portal_local_auth_mfa: optString(props, "portal_local_auth_mfa", ""),
        resource_access_mfa: optString(props, "resource_access_mfa", ""),
      };
    });

    afterAll(async () => {
      await ignoreError(dropDirectoryUser());
      await restoreOriginal();
      await ignoreError(api.logout());
    });

    test(
      "replace true then false: pushtotp row count follows replace_device_token_workflow",
      async () => {
        // Same MFA options for both branches (mirrors UI leaving MFA dropdown set).
        // Only replace_device_token_workflow toggles — that alone must control enroll.
        const mfaOpts = {
          mfa_provider: MFA_PROVIDER.PUSHTOTP,
          portal_local_auth_mfa: MFA_PROVIDER.PUSHTOTP,
          resource_access_mfa: MFA_PROVIDER.PUSHTOTP,
        };

        // replace ON → enroll → pushtotp count > 0
        await updateAzureOptions({
          replace_device_token_workflow: "true",
          ...mfaOpts,
        });
        await dropDirectoryUser();
        await addDirectoryUser();
        await enrollDirectoryMfaIfNeeded();
        expect(await countPushTotpRows()).toBeGreaterThan(0);

        await dropDirectoryUser();

        // replace OFF only (MFA options still set, as in UI) → must be 0
        await updateAzureOptions({
          replace_device_token_workflow: "false",
          ...mfaOpts,
        });
        await addDirectoryUser();
        await enrollDirectoryMfaIfNeeded();
        expect(await countPushTotpRows()).toBe(0);

        await dropDirectoryUser();
        await restoreOriginal();
      },
      180000,
    );
  },
);

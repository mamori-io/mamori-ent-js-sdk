/**
 * Google portal/resource MFA enrollment — admin only, no subject login.
 *
 * MFA ON then OFF:
 *   set provider MFA options → add directory user → ENROLL_DIRECTORY_MFA_IF_NEEDED →
 *   count pushtotp rows in SYS.USER_AUTHENTICATION_PROVIDERS → drop user.
 * Expect count > 0 when portal/resource MFA is PushTOTP, else 0.
 *
 * Uses ephemeral provider sdk_google_mfa_test (does not mutate googleworkspace).
 *
 * Env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD
 *      MAMORI_GOOGLE_* (SA JSON, admin_email, domain) via googleValidateReady()
 * Optional: MAMORI_GOOGLE_USER (default omasri@mamori.io)
 */
import { MamoriService } from "../../api";
import { ignoreError } from "../../utils";
import { INSECURE_HTTPS } from "../../__utility__/auth-test-harness";
import {
  GOOGLE_MFA_TEST_PROVIDER,
  addDirectoryUserAsserted,
  countPushTotpRows,
  createProviderAsserted,
  dropDirectoryUserIgnore,
  dropProviderIgnore,
  enrollDirectoryMfaIfNeeded,
  googleProviderCreateBody,
  googleUserFromEnv,
  googleValidateReady,
  updateGoogleDirectoryMfa,
} from "../../__utility__/oauth-directory-provider-harness";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const googleUser = googleUserFromEnv();
const providerName = GOOGLE_MFA_TEST_PROVIDER;

const gated =
  host && username && password && googleUser && googleValidateReady()
    ? describe
    : describe.skip;

gated(
  "google directory MFA by portal/resource MFA options" +
    (testbatch ? " " + testbatch : ""),
  () => {
    let api: MamoriService;

    async function dropDirectoryUser(): Promise<void> {
      await dropDirectoryUserIgnore(api, providerName, googleUser);
    }

    async function addDirectoryUser(): Promise<void> {
      await addDirectoryUserAsserted(api, providerName, googleUser);
    }

    beforeAll(async () => {
      // #region agent log
      fetch("http://localhost:7834/ingest/d9613878-9a76-46e3-9c79-0350bdc432a9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "755db8",
        },
        body: JSON.stringify({
          sessionId: "755db8",
          runId: "dir-user-probe",
          hypothesisId: "E-env-user",
          location: "api.google-directory-mfa.ts:beforeAll",
          message: "resolved google directory subject",
          data: {
            envGoogleUserSet: !!(process.env.MAMORI_GOOGLE_USER || "").trim(),
            googleUserLen: (googleUser || "").length,
            googleUserDomain: (googleUser || "").includes("@")
              ? (googleUser || "").split("@")[1]
              : "",
            googleUserLooksDummy: /dummy|fake|nosuch|doesnotexist/i.test(
              googleUser || "",
            ),
            providerName,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      api = new MamoriService(host, INSECURE_HTTPS);
      await api.login(username, password);

      await dropDirectoryUser();
      await dropProviderIgnore(api, providerName);
      await createProviderAsserted(
        api,
        googleProviderCreateBody(providerName),
      );
    });

    afterAll(async () => {
      await ignoreError(dropDirectoryUser());
      await dropProviderIgnore(api, providerName);
      await ignoreError(api.logout());
    });

    test(
      "MFA on then off: pushtotp row count follows portal/resource MFA options",
      async () => {
        // MFA ON → enroll → pushtotp count > 0
        await updateGoogleDirectoryMfa(api, providerName, true);
        await dropDirectoryUser();
        await addDirectoryUser();
        await enrollDirectoryMfaIfNeeded(api, googleUser, providerName);
        expect(await countPushTotpRows(api, googleUser)).toBeGreaterThan(0);

        await dropDirectoryUser();

        // MFA OFF (cleared portal/resource) → must be 0
        await updateGoogleDirectoryMfa(api, providerName, false);
        await addDirectoryUser();
        await enrollDirectoryMfaIfNeeded(api, googleUser, providerName);
        expect(await countPushTotpRows(api, googleUser)).toBe(0);

        await dropDirectoryUser();
      },
      180000,
    );
  },
);

/**
 * Shared helpers for OAuth directory authentication providers (Azure / Google / AWS IDC).
 */
import { MamoriService } from "../api";
import { DirectoryUser, MFA_PROVIDER } from "../user";
import { noThrow, ignoreError } from "../utils";
import {
  assertOperationOk,
  col,
  directoryUserRows,
  isApiError,
  rowsOf,
} from "./auth-test-harness";
import { selectQuery, sleep } from "./test-helper";

/** Ephemeral Google provider name for MFA suite (does not touch googleworkspace). */
export const GOOGLE_MFA_TEST_PROVIDER = "sdk_google_mfa_test";

const PROVIDER_RELOAD_MS = 5000;

export type OAuthDirectoryProviderKind = "azure" | "google" | "awsidc";

export type DirectoryProviderInfo = {
  name: string;
  type: string;
  properties: any;
  row: any;
};

export type GoogleCredentials = {
  providerName: string;
  clientId: string;
  clientSecret: string;
  authUri: string;
  tokenUri: string;
  redirectUri: string;
  domain: string;
  customerId: string;
  adminEmail: string;
  serviceAccountJson: string;
  message: string;
};

function envTrim(name: string, fallback: string = ""): string {
  const v = process.env[name];
  if (v == null) {
    return fallback;
  }
  return String(v).trim();
}

/** True when provider row type matches the OAuth directory kind. */
export function isDirectoryProviderType(
  row: any,
  kind: OAuthDirectoryProviderKind,
): boolean {
  const type = String(
    col(row, "provider_type") || col(row, "type") || "",
  ).toLowerCase();
  return type === kind;
}

/**
 * Pick a directory auth provider from GET /v1/providers.
 * Optional preferredName wins when present; otherwise first matching type.
 */
export async function findDirectoryProvider(
  api: MamoriService,
  kind: OAuthDirectoryProviderKind,
  preferredName?: string,
): Promise<DirectoryProviderInfo> {
  const listed = await noThrow(api.providers());
  if (isApiError(listed)) {
    throw new Error("providers() failed: " + JSON.stringify(listed));
  }
  const kindRows = rowsOf(listed).filter((r) =>
    isDirectoryProviderType(r, kind),
  );
  if (kindRows.length === 0) {
    throw new Error(
      "No " + kind + " directory authentication provider found via providers()",
    );
  }
  const prefer = (preferredName || "").trim().toLowerCase();
  const match =
    (prefer
      ? kindRows.find(
          (r) =>
            String(col(r, "provider_name") || col(r, "name") || "")
              .toLowerCase() === prefer,
        )
      : undefined) || kindRows[0];
  const name = String(
    col(match, "provider_name") || col(match, "name") || "",
  ).trim();
  if (!name) {
    throw new Error(
      kind + " provider row missing provider_name: " + JSON.stringify(match),
    );
  }
  const got = await noThrow(api.get_provider(name));
  if (isApiError(got)) {
    throw new Error("get_provider(" + name + ") failed: " + JSON.stringify(got));
  }
  return {
    name,
    type: String((got as any).provider_type || (got as any).type || kind),
    properties: (got as any).properties || {},
    row: got,
  };
}

/** Read Google Workspace credentials from MAMORI_GOOGLE_* env. */
export function googleCredentialsFromEnv(): GoogleCredentials {
  const testbatch = envTrim("MAMORI_TEST_BATCH");
  const named = envTrim("MAMORI_GOOGLE_PROVIDER");
  return {
    providerName: named || "test_google_" + testbatch,
    clientId: envTrim("MAMORI_GOOGLE_CLIENT_ID") || "test-google-client-id",
    clientSecret:
      envTrim("MAMORI_GOOGLE_CLIENT_SECRET") || "test-google-client-secret",
    authUri:
      envTrim("MAMORI_GOOGLE_AUTH_URI") ||
      "https://accounts.google.com/o/oauth2/auth",
    tokenUri:
      envTrim("MAMORI_GOOGLE_TOKEN_URI") ||
      "https://oauth2.googleapis.com/token",
    redirectUri: envTrim("MAMORI_GOOGLE_REDIRECT_URI"),
    domain: envTrim("MAMORI_GOOGLE_DOMAIN"),
    customerId: envTrim("MAMORI_GOOGLE_CUSTOMER_ID"),
    adminEmail: envTrim("MAMORI_GOOGLE_ADMIN_EMAIL"),
    serviceAccountJson: envTrim("MAMORI_GOOGLE_SERVICE_ACCOUNT_JSON"),
    message: envTrim("MAMORI_GOOGLE_MESSAGE", "Sign in with Google"),
  };
}

/**
 * True when Hub validate_auth_provider can exercise Directory API
 * (service account + admin email + domain).
 */
export function googleValidateReady(): boolean {
  const c = googleCredentialsFromEnv();
  return !!(c.serviceAccountJson && c.adminEmail && c.domain);
}

/** Directory subject for Google MFA / directory-user tests. */
export function googleUserFromEnv(): string {
  return envTrim("MAMORI_GOOGLE_USER", "omasri@mamori.io");
}

/**
 * Toggle Google portal/resource PushTOTP MFA options (Google has no replace-device gate).
 * enabled=true sets PushTOTP on mfa_provider + portal + resource; false clears them.
 */
export async function updateGoogleDirectoryMfa(
  api: MamoriService,
  providerName: string,
  enabled: boolean,
): Promise<void> {
  const body: Record<string, string> = {
    name: providerName,
    type: MFA_PROVIDER.GOOGLE,
  };
  if (enabled) {
    body.mfa_provider = MFA_PROVIDER.PUSHTOTP;
    body.portal_local_auth_mfa = MFA_PROVIDER.PUSHTOTP;
    body.resource_access_mfa = MFA_PROVIDER.PUSHTOTP;
  } else {
    body.mfa_provider = "";
    body.portal_local_auth_mfa = "";
    body.resource_access_mfa = "";
  }
  const r = await noThrow(api.update_provider(providerName, body));
  assertOperationOk("update_provider MFA(" + providerName + ")", r);
  await sleep(PROVIDER_RELOAD_MS);
}

export async function dropDirectoryUserIgnore(
  api: MamoriService,
  providerName: string,
  username: string,
): Promise<void> {
  await ignoreError(new DirectoryUser(providerName, username).delete(api));
}

export async function addDirectoryUserAsserted(
  api: MamoriService,
  providerName: string,
  username: string,
): Promise<void> {
  const dirUser = new DirectoryUser(providerName, username);
  await ignoreError(dirUser.delete(api));
  const createResult = await noThrow(dirUser.create(api));
  // #region agent log
  {
    const isArr = Array.isArray(createResult);
    const errFlag =
      createResult &&
      typeof createResult === "object" &&
      ((createResult as any).errors === true ||
        (createResult as any).error === true);
    fetch("http://localhost:7834/ingest/d9613878-9a76-46e3-9c79-0350bdc432a9", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "755db8",
      },
      body: JSON.stringify({
        sessionId: "755db8",
        runId: "dir-user-probe",
        hypothesisId: "A-create-response",
        location: "oauth-directory-provider-harness.ts:addDirectoryUserAsserted",
        message: "directory user create response",
        data: {
          providerName,
          usernameLen: (username || "").length,
          usernameHasAt: (username || "").includes("@"),
          usernameDomain: (username || "").includes("@")
            ? (username || "").split("@")[1]
            : "",
          isArray: isArr,
          arrayLen: isArr ? (createResult as any[]).length : -1,
          looksLikeError: !!errFlag,
          responseType:
            createResult === null || createResult === undefined
              ? String(createResult)
              : typeof createResult,
          keys:
            createResult &&
            typeof createResult === "object" &&
            !Array.isArray(createResult)
              ? Object.keys(createResult as object).slice(0, 12)
              : [],
          preview: JSON.stringify(createResult).slice(0, 240),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  assertOperationOk(
    "directory user create(" + username + ")",
    createResult,
  );
  const rows = await directoryUserRows(api, username);
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
      hypothesisId: "B-local-row",
      location:
        "oauth-directory-provider-harness.ts:addDirectoryUserAsserted:rows",
      message: "SYS.DIRECTORY_USERS row count after create",
      data: {
        usernameDomain: (username || "").includes("@")
          ? (username || "").split("@")[1]
          : "",
        rowCount: rows.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (rows.length === 0) {
    throw new Error(
      "directory user create: no SYS.DIRECTORY_USERS row for " + username,
    );
  }
}

/** Body for POST /v1/providers (type=google). */
export function googleProviderCreateBody(
  name?: string,
): Record<string, string> {
  const c = googleCredentialsFromEnv();
  const body: Record<string, string> = {
    name: name || c.providerName,
    type: MFA_PROVIDER.GOOGLE,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    auth_uri: c.authUri,
    token_uri: c.tokenUri,
    message: c.message || "Sign in with Google",
  };
  if (c.domain) {
    body.domain = c.domain;
  }
  if (c.customerId) {
    body.customer_id = c.customerId;
  }
  if (c.adminEmail) {
    body.admin_email = c.adminEmail;
  }
  if (c.serviceAccountJson) {
    body.service_account_json = c.serviceAccountJson;
  }
  if (c.redirectUri) {
    body.redirect_uri = c.redirectUri;
  }
  return body;
}

export async function createProviderAsserted(
  api: MamoriService,
  body: Record<string, any>,
): Promise<any> {
  const r = await noThrow(api.add_provider(body));
  assertOperationOk("add_provider(" + body.name + ")", r);
  return r;
}

export async function getProviderAsserted(
  api: MamoriService,
  name: string,
): Promise<any> {
  const r = await noThrow(api.get_provider(name));
  assertOperationOk("get_provider(" + name + ")", r);
  return r;
}

/**
 * VALIDATE_AUTHENTICATION_PROVIDER returns rows: status, provider_name, message.
 * assertOperationOk treats any array as OK — must require status SUCCESS.
 */
export async function validateProviderAsserted(
  api: MamoriService,
  name: string,
): Promise<any> {
  const r = await noThrow(api.validate_auth_provider(name));
  if (isApiError(r)) {
    throw new Error(
      "validate_auth_provider(" + name + ") failed: " + JSON.stringify(r),
    );
  }
  const rows = rowsOf(r);
  if (rows.length === 0) {
    throw new Error(
      "validate_auth_provider(" +
        name +
        ") returned no rows: " +
        JSON.stringify(r),
    );
  }
  for (const row of rows) {
    const status = String(
      col(row, "status") ?? (Array.isArray(row) ? row[0] : ""),
    ).toUpperCase();
    if (status !== "SUCCESS") {
      throw new Error(
        "validate_auth_provider(" +
          name +
          ") status=" +
          status +
          ": " +
          JSON.stringify(row),
      );
    }
  }
  return r;
}

export async function dropProviderIgnore(
  api: MamoriService,
  name: string,
): Promise<void> {
  await ignoreError(api.drop_provider(name));
}

/** Count pushtotp rows for a user in SYS.USER_AUTHENTICATION_PROVIDERS. */
export async function countPushTotpRows(
  api: MamoriService,
  username: string,
): Promise<number> {
  const escaped = username.replace(/'/g, "''");
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
      "SYS.USER_AUTHENTICATION_PROVIDERS query failed: " + JSON.stringify(rows),
    );
  }
  return Array.isArray(rows) ? rows.length : 0;
}

/** Call ENROLL_DIRECTORY_MFA_IF_NEEDED(username, directoryProviderName). */
export async function enrollDirectoryMfaIfNeeded(
  api: MamoriService,
  username: string,
  directoryProviderName: string,
): Promise<any> {
  const r = await noThrow(
    api.call("ENROLL_DIRECTORY_MFA_IF_NEEDED", username, directoryProviderName),
  );
  // #region agent log
  {
    const pushCount = await countPushTotpRows(api, username).catch(() => -1);
    fetch("http://localhost:7834/ingest/d9613878-9a76-46e3-9c79-0350bdc432a9", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "755db8",
      },
      body: JSON.stringify({
        sessionId: "755db8",
        runId: "dir-user-probe",
        hypothesisId: "C-enroll-mfa-only",
        location: "oauth-directory-provider-harness.ts:enrollDirectoryMfaIfNeeded",
        message: "enroll result and pushtotp count",
        data: {
          directoryProviderName,
          usernameDomain: (username || "").includes("@")
            ? (username || "").split("@")[1]
            : "",
          isApiError: isApiError(r),
          isArray: Array.isArray(r),
          preview: JSON.stringify(r).slice(0, 240),
          pushTotpCountAfter: pushCount,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  if (isApiError(r)) {
    throw new Error(
      "ENROLL_DIRECTORY_MFA_IF_NEEDED failed: " + JSON.stringify(r),
    );
  }
  return r;
}

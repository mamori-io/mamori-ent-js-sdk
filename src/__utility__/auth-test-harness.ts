/**
 * Shared admin + subject session helpers for auth / MFA / connection catalog asserts (ch10588).
 */
import * as https from "https";
import { MamoriService, io_connectionlog } from "../api";
import { noThrow, ignoreError } from "../utils";
import { selectQuery, sleep } from "./test-helper";

export const PORTAL_LOGIN_APPLICATION = "Mamori Portal Login";

export const INSECURE_HTTPS = new https.Agent({ rejectUnauthorized: false });

export function rowsOf(res: any): any[] {
  if (!res) {
    return [];
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (Array.isArray(res.data)) {
    return res.data;
  }
  if (Array.isArray(res.rows)) {
    return res.rows;
  }
  return [];
}

export function col(row: any, name: string): any {
  if (row == null) {
    return undefined;
  }
  if (row[name] !== undefined) {
    return row[name];
  }
  const upper = name.toUpperCase();
  if (row[upper] !== undefined) {
    return row[upper];
  }
  const lower = name.toLowerCase();
  if (row[lower] !== undefined) {
    return row[lower];
  }
  return undefined;
}

export function eventText(ev: any): string {
  const parts = [
    col(ev, "message"),
    col(ev, "event"),
    col(ev, "event_type"),
    col(ev, "type"),
    col(ev, "description"),
    JSON.stringify(ev),
  ];
  return parts
    .filter((p) => p != null && String(p).length > 0)
    .join(" ")
    .toLowerCase();
}

export function messagesContain(events: any[], substrings: string[]): boolean {
  const joined = events.map(eventText).join("\n");
  return substrings.every((s) => joined.indexOf(s.toLowerCase()) >= 0);
}

export function messagesContainAny(events: any[], substrings: string[]): boolean {
  const joined = events.map(eventText).join("\n");
  return substrings.some((s) => joined.indexOf(s.toLowerCase()) >= 0);
}

export function isNoOauthPortalSessionFailure(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    (m.indexOf("oauth") >= 0 &&
      (m.indexOf("portal session") >= 0 || m.indexOf("no active oauth") >= 0)) ||
    m.indexOf("first login via oauth") >= 0 ||
    m.indexOf("enable local and proxy authentication") >= 0
  );
}

export function isApiError(r: unknown): boolean {
  return (
    r != null &&
    typeof r === "object" &&
    ((r as any).errors === true ||
      (r as any).error ||
      (r as any).status >= 400 ||
      (r as any).success === false)
  );
}

/** Portal password login (Login.vue application string). */
export function portalLogin(
  host: string,
  user: string,
  password: string,
  httpsAgent: https.Agent = INSECURE_HTTPS,
): Promise<any> {
  const client = new MamoriService(host, httpsAgent);
  return noThrow(
    client.login(user, password, undefined, PORTAL_LOGIN_APPLICATION),
  );
}

export async function assertProviderOption(
  api: MamoriService,
  providerName: string,
  optionKey: string,
  expected: string,
): Promise<void> {
  const got = await noThrow(api.get_provider(providerName));
  expect(got && (got as any).errors).not.toBe(true);
  const props = (got && (got as any).properties) || {};
  expect(String(props[optionKey])).toBe(expected);
}

export async function authProviderRows(
  api: MamoriService,
  userName: string,
): Promise<any[]> {
  const escaped = userName.replace(/'/g, "''");
  const rows = await selectQuery(
    api,
    "SELECT * FROM SYS.USER_AUTHENTICATION_PROVIDERS WHERE lower(user_name) = lower('" +
      escaped +
      "')",
  );
  if (rows && rows.errors) {
    throw new Error(
      "SYS.USER_AUTHENTICATION_PROVIDERS query failed: " + JSON.stringify(rows),
    );
  }
  return Array.isArray(rows) ? rows : [];
}

export async function assertUserMfaApplies(
  api: MamoriService,
  userName: string,
  expectedApplies: string[],
): Promise<void> {
  const rows = await authProviderRows(api, userName);
  const applies = rows
    .map((r) => String(col(r, "mfa_apply") || "").trim())
    .filter((a) => a.length > 0)
    .sort();
  expect(applies).toEqual([...expectedApplies].map(String).sort());
}

/**
 * Connection log rows for a login username (newest first).
 */
export async function listConnectionLogForUser(
  api: MamoriService,
  loginUsername: string,
  take: number = 50,
): Promise<any[]> {
  const res = await noThrow(
    io_connectionlog.ConnectionLog.list(
      api,
      0,
      take,
      [["login_username", "equals", loginUsername]],
      [{ selector: "starttime", desc: true }],
    ),
  );
  if (res && (res as any).errors) {
    return [];
  }
  return rowsOf(res);
}

/**
 * Recent connection/auth events. Prefer connection_id when known; otherwise take a
 * recent page and filter client-side by message text / username.
 */
export async function listAuthEventsRecent(
  api: MamoriService,
  take: number = 100,
  connectionId?: string | number,
): Promise<any[]> {
  const filter = connectionId
    ? [["connection_id", "=", connectionId]]
    : undefined;
  const res = await noThrow(
    io_connectionlog.ConnectionLog.listEvents(api, 0, take, filter),
  );
  if (res && (res as any).errors) {
    return [];
  }
  return rowsOf(res);
}

/**
 * After a subject action, wait briefly then return recent events whose text
 * mentions any of the needles (username, provider, oauth, azure, …).
 * When connectionId is set, only that connection's events are loaded.
 */
export async function collectAuthEventsMentioning(
  api: MamoriService,
  needles: string[],
  opts?: { waitMs?: number; take?: number; connectionId?: string | number },
): Promise<any[]> {
  const waitMs = opts && opts.waitMs != null ? opts.waitMs : 1500;
  const take = opts && opts.take != null ? opts.take : 150;
  await sleep(waitMs);
  const events = await listAuthEventsRecent(api, take, opts && opts.connectionId);
  const lowerNeedles = needles.map((n) => n.toLowerCase());
  return events.filter((ev) => {
    const t = eventText(ev);
    return lowerNeedles.some((n) => t.indexOf(n) >= 0);
  });
}

export async function withSubjectSession<T>(
  host: string,
  subjectUser: string,
  subjectPassword: string,
  fn: (subjectApi: MamoriService) => Promise<T>,
  httpsAgent: https.Agent = INSECURE_HTTPS,
): Promise<T> {
  const subjectApi = new MamoriService(host, httpsAgent);
  try {
    await subjectApi.login(subjectUser, subjectPassword);
    return await fn(subjectApi);
  } finally {
    await ignoreError(subjectApi.logout());
  }
}

/**
 * Kill open connections for a user so replace-device-token cannot reuse an
 * ambient OAuth portal session from a previous browser login.
 */
export async function killOpenSessionsForUser(
  api: MamoriService,
  loginUsername: string,
): Promise<number> {
  const rows = await listConnectionLogForUser(api, loginUsername, 100);
  let killed = 0;
  for (const row of rows) {
    const ssid = col(row, "ssid") || col(row, "SSID");
    const end = col(row, "endtime") || col(row, "ENDTIME");
    // Prefer open sessions (no endtime); still try kill if ssid present
    if (!ssid) {
      continue;
    }
    if (end != null && String(end).trim() !== "") {
      continue;
    }
    const r = await noThrow(
      api.select("CALL KILL_SESSION('" + String(ssid).replace(/'/g, "''") + "')"),
    );
    if (!isApiError(r)) {
      killed++;
    }
  }
  await sleep(500);
  return killed;
}

/** Treat string "ok" and non-error objects as success (directory delete APIs). */
export function assertOperationOk(label: string, r: unknown): void {
  if (r === "ok" || r === true) {
    return;
  }
  if (Array.isArray(r)) {
    return;
  }
  if (r != null && typeof r === "object" && (r as any).errors !== true && (r as any).error !== true) {
    if ((r as any).error === false || (r as any).errors === false || (r as any).complete === true) {
      return;
    }
    // DevExpress / task payloads without errors
    if ((r as any).result === 0 || (r as any).status === "ok") {
      return;
    }
  }
  if (isApiError(r)) {
    throw new Error(`${label} failed: ` + JSON.stringify(r));
  }
}

/** True for Azure directory auth providers (not azureoauth). */
export function isAzureDirectoryProvider(row: any): boolean {
  const type = String(col(row, "provider_type") || col(row, "type") || "").toLowerCase();
  return type === "azure";
}

/**
 * Pick an Azure directory provider from GET /v1/providers.
 * Optional preferredName wins when present; otherwise first azure provider.
 */
export async function findAzureDirectoryProvider(
  api: MamoriService,
  preferredName?: string,
): Promise<{ name: string; type: string; properties: any; row: any }> {
  const listed = await noThrow(api.providers());
  if (isApiError(listed)) {
    throw new Error("providers() failed: " + JSON.stringify(listed));
  }
  const azureRows = rowsOf(listed).filter(isAzureDirectoryProvider);
  if (azureRows.length === 0) {
    throw new Error("No Azure directory authentication provider found via providers()");
  }
  const prefer = (preferredName || "").trim().toLowerCase();
  const match =
    (prefer
      ? azureRows.find(
          (r) =>
            String(col(r, "provider_name") || col(r, "name") || "")
              .toLowerCase() === prefer,
        )
      : undefined) || azureRows[0];
  const name = String(col(match, "provider_name") || col(match, "name") || "").trim();
  if (!name) {
    throw new Error("Azure provider row missing provider_name: " + JSON.stringify(match));
  }
  const got = await noThrow(api.get_provider(name));
  if (isApiError(got)) {
    throw new Error("get_provider(" + name + ") failed: " + JSON.stringify(got));
  }
  return {
    name,
    type: String((got as any).provider_type || (got as any).type || "azure"),
    properties: (got as any).properties || {},
    row: got,
  };
}

/** Admin: pending QR validation rows via USER_VALIDATION_ENTRY(username, delete?). */
export async function userValidationEntries(
  api: MamoriService,
  userName: string,
  deleteEntry: boolean = false,
): Promise<any[]> {
  const escaped = userName.replace(/'/g, "''");
  const rows = await selectQuery(
    api,
    "CALL USER_VALIDATION_ENTRY('" + escaped + "', " + (deleteEntry ? "true" : "false") + ")",
  );
  if (rows && rows.errors) {
    throw new Error("USER_VALIDATION_ENTRY failed: " + JSON.stringify(rows));
  }
  return Array.isArray(rows) ? rows : [];
}

export async function directoryUserRows(
  api: MamoriService,
  userName: string,
): Promise<any[]> {
  const escaped = userName.replace(/'/g, "''");
  const rows = await selectQuery(
    api,
    "SELECT * FROM SYS.DIRECTORY_USERS WHERE lower(username) = lower('" +
      escaped +
      "') AND deleted_at IS NULL",
  );
  if (rows && rows.errors) {
    throw new Error("SYS.DIRECTORY_USERS query failed: " + JSON.stringify(rows));
  }
  return Array.isArray(rows) ? rows : [];
}

/** Mamori MFA enrollment rows (scoped apply or common MFA provider names). */
export function mamoriMfaEnrollmentRows(rows: any[]): any[] {
  return (rows || []).filter((r) => {
    const provider = String(col(r, "provider_name") || "").toLowerCase();
    const apply = String(col(r, "mfa_apply") || "").trim();
    if (provider === "password" || provider === "") {
      return false;
    }
    return (
      apply.length > 0 ||
      provider === "pushtotp" ||
      provider === "pushmobile" ||
      provider === "totp"
    );
  });
}

export function assertNoMamoriMfaEnrollment(rows: any[], label: string): void {
  const mfa = mamoriMfaEnrollmentRows(rows);
  if (mfa.length > 0) {
    throw new Error(
      label + ": expected no Mamori MFA enrollment rows, got " + JSON.stringify(mfa),
    );
  }
}

export async function assertNoPendingMfaQr(
  api: MamoriService,
  userName: string,
  label: string,
): Promise<void> {
  const entries = await userValidationEntries(api, userName, false);
  const pending = entries.filter((r) => {
    const guid = col(r, "guid") || col(r, "GUID");
    return guid != null && String(guid).trim() !== "";
  });
  if (pending.length > 0) {
    throw new Error(
      label +
        ": expected no pending Mamori MFA QR (user_validation), got " +
        JSON.stringify(pending),
    );
  }
}

/**
 * Assert Mamori MFA enrollment is present: scoped auth-provider rows and/or pending QR guid.
 * When a guid exists, verifies get_qr_code returns a real otpauth payload.
 */
export async function assertMamoriMfaEnrollmentPending(
  api: MamoriService,
  userName: string,
  label: string,
): Promise<void> {
  const authRows = await authProviderRows(api, userName);
  const mfaRows = mamoriMfaEnrollmentRows(authRows);
  const validation = await userValidationEntries(api, userName, false);
  const guidRow = validation.find((r) => {
    const guid = col(r, "guid") || col(r, "GUID");
    return guid != null && String(guid).trim() !== "";
  });
  const guid = guidRow
    ? String(col(guidRow, "guid") || col(guidRow, "GUID") || "").trim()
    : "";

  if (mfaRows.length === 0 && !guid) {
    throw new Error(
      label +
        ": expected Mamori MFA enrollment (scoped USER_AUTHENTICATION_PROVIDERS or user_validation QR), found neither",
    );
  }

  if (guid) {
    const qr = await noThrow(api.get_qr_code(guid));
    if (isApiError(qr)) {
      throw new Error(label + ": get_qr_code failed: " + JSON.stringify(qr));
    }
    const qrCode = String((qr as any).qr_code || "");
    if (!qrCode || qrCode === "Nothing to see here") {
      throw new Error(label + ": expected usable MFA QR code for guid " + guid);
    }
  }
}

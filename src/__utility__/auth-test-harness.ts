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

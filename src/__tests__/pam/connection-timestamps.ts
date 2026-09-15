/**
 * Connection log vs connection-events timestamp consistency.
 *
 * Opens a live websocket query session (creates mamoriconnections + events),
 * then compares connection_log.starttime with connection_events.inserted_at.
 *
 * Load env before running, e.g.:
 *   set -a && . ./working/local.sh && set +a && npx jest src/__tests__/pam/connection-timestamps.ts
 *
 * Required env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD
 *
 * After Hub change (UTC Z serialization), these should align within seconds —
 * not hours apart from JVM-local vs UTC skew.
 */
import {
  MamoriService,
  MamoriWebsocketClient,
  io_https,
  io_utils,
  io_connectionlog,
} from "../../api";
import { sleep } from "../../__utility__/test-helper";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

/** Max allowed skew between connection start and first auth event (ms). */
const MAX_EVENT_LAG_MS = 2 * 60 * 1000;
/** Fail if timestamps differ by roughly a timezone offset (hours). */
const HOUR_SKEW_FAIL_MS = 30 * 60 * 1000;

function parseInstantMs(value: any): number {
  if (value == null || value === "") {
    return NaN;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  // Normalize space-separated timestamps for Date.parse
  const s = String(value).trim().replace(" ", "T");
  const ms = Date.parse(s);
  return ms;
}

function rowsOf(res: any): any[] {
  if (!res) {
    return [];
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

describe(
  "connection timestamp consistency" + (testbatch ? " " + testbatch : ""),
  () => {
    let api: MamoriService;
    let ws: MamoriWebsocketClient | null = null;
    let connectionId: number | string | null = null;
    let connectionSsid: string | null = null;
    let starttimeRaw: any = null;

    beforeAll(async () => {
      api = new MamoriService(host, INSECURE);
      await api.login(username, password);
    });

    afterAll(async () => {
      if (ws) {
        try {
          ws.disconnect();
        } catch (_e) {
          /* ignore */
        }
      }
      await api.logout();
    });

    test(
      "websocket session creates connection log and events with aligned timestamps",
      async () => {
        const markerMs = Date.now() - 5000;

        ws = await api.wsLogin();
        expect(ws).toBeTruthy();

        // Touch the session so auth/connection events are written
        const q = await io_utils.noThrow(
          ws.query("SELECT 1 AS n FROM SYS.DUAL"),
        );
        expect(q.errors).toBeFalsy();

        await sleep(1500);

        // Find the connection we just opened (newest starttime for this user)
        const logRes = await io_utils.noThrow(
          io_connectionlog.ConnectionLog.list(
            api,
            0,
            25,
            [["login_username", "equals", username]],
            [{ selector: "starttime", desc: true }],
          ),
        );
        expect(logRes.errors).toBeFalsy();

        const logRows = rowsOf(logRes);
        expect(logRows.length).toBeGreaterThan(0);

        let conn: any = null;
        for (const row of logRows) {
          const startMs = parseInstantMs(row.starttime);
          if (!Number.isNaN(startMs) && startMs >= markerMs) {
            // Prefer websocket / query protocol when several match
            const proto = String(row.protocol || "").toLowerCase();
            if (
              !conn ||
              proto === "wss" ||
              proto === "websql" ||
              proto.indexOf("web") >= 0
            ) {
              conn = row;
              if (proto === "wss" || proto === "websql") {
                break;
              }
            }
          }
        }
        expect(conn).toBeTruthy();
        expect(parseInstantMs(conn.starttime)).toBeGreaterThanOrEqual(markerMs);
        connectionId = conn.id;
        connectionSsid = conn.ssid;
        starttimeRaw = conn.starttime;

        expect(connectionId).toBeTruthy();
        expect(starttimeRaw).toBeTruthy();

        const startMs = parseInstantMs(starttimeRaw);
        expect(Number.isNaN(startMs)).toBe(false);

        // connection_log (Elixir/Repo) should be UTC ISO with Z
        if (typeof starttimeRaw === "string") {
          expect(starttimeRaw).toMatch(/Z$/i);
        }

        const eventsRes = await io_utils.noThrow(
          io_connectionlog.ConnectionLog.listEvents(api, 0, 50, [
            ["connection_id", "=", connectionId],
          ]),
        );
        expect(eventsRes.errors).toBeFalsy();

        const events = rowsOf(eventsRes);
        expect(events.length).toBeGreaterThan(0);

        // Earliest event by inserted_at
        const sorted = [...events].sort((a, b) => {
          return parseInstantMs(a.inserted_at) - parseInstantMs(b.inserted_at);
        });
        const firstEvent = sorted[0];
        const eventRaw = firstEvent.inserted_at;
        const eventMs = parseInstantMs(eventRaw);

        expect(eventRaw).toBeTruthy();
        expect(Number.isNaN(eventMs)).toBe(false);

        // Must include an absolute zone (Z or ±HH:MM). Zone-less local wall clock
        // is the buggy Hub serialization that makes Event Time hours ahead in the UI.
        if (typeof eventRaw === "string") {
          expect(eventRaw).toMatch(/(Z|[+-]\d{2}:?\d{2})$/i);
        }

        const deltaMs = Math.abs(eventMs - startMs);

        // Must not look like an 8h (or multi-hour) timezone mis-serialization
        expect(deltaMs).toBeLessThan(HOUR_SKEW_FAIL_MS);

        // First auth event should be near connection start
        expect(deltaMs).toBeLessThan(MAX_EVENT_LAG_MS);

        // Event should not be substantially before connection start
        expect(eventMs + 5000).toBeGreaterThanOrEqual(startMs);

        // Keep a breadcrumb for failures
        // eslint-disable-next-line no-console
        console.log(
          "timestamp check",
          JSON.stringify({
            connectionId,
            connectionSsid,
            starttime: starttimeRaw,
            firstEventAt: eventRaw,
            deltaMs,
            protocol: conn.protocol,
          }),
        );
      },
      90000,
    );

    test("connection_log starttime and later events stay within same clock", async () => {
      if (!connectionId || starttimeRaw == null) {
        console.log("skip: prior test did not capture a connection");
        return;
      }

      const eventsRes = await io_utils.noThrow(
        io_connectionlog.ConnectionLog.listEvents(api, 0, 100, [
          ["connection_id", "=", connectionId],
        ]),
      );
      expect(eventsRes.errors).toBeFalsy();
      const events = rowsOf(eventsRes);
      expect(events.length).toBeGreaterThan(0);

      const startMs = parseInstantMs(starttimeRaw);
      for (const ev of events) {
        const ms = parseInstantMs(ev.inserted_at);
        expect(Number.isNaN(ms)).toBe(false);
        const delta = Math.abs(ms - startMs);
        // All events for this short session should be far below timezone-offset skew
        expect(delta).toBeLessThan(HOUR_SKEW_FAIL_MS);
      }
    });
  },
);

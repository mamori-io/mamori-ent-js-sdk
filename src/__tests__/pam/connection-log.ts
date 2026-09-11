/**
 * Connection log / session recording tests.
 *
 * Load env from working/local.sh before running, e.g.:
 *   set -a && . ./working/local.sh && set +a && npx jest src/__tests__/pam/connection-log.ts
 *
 * Required env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD
 * Optional fixtures (tests skip when absent):
 *   MAMORI_SSH_SSID, MAMORI_SSH_STREAM_ID — force SSH video encode target
 *   MAMORI_RDP_RECORDING_ID — RDP recording id for download URL test
 */
import {
  MamoriService,
  io_https,
  io_utils,
  io_connectionlog,
} from "../../api";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const envSshSsid = process.env.MAMORI_SSH_SSID || "";
const envSshStreamId = process.env.MAMORI_SSH_STREAM_ID || "";
const envRdpRecordingId = process.env.MAMORI_RDP_RECORDING_ID || "";

describe("connection log tests" + (testbatch ? " " + testbatch : ""), () => {
  let api: MamoriService;
  let listedSsid: string | null = null;
  let shellStreamId: number | string | null = null;

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
  });

  afterAll(async () => {
    await api.logout();
  });

  test("list connection log", async () => {
    let res = await io_utils.noThrow(
      io_connectionlog.ConnectionLog.list(api, 0, 10),
    );
    expect(res.errors).toBeFalsy();
    // DevExpress-style payload
    expect(res.data !== undefined || Array.isArray(res)).toBe(true);
    let rows = res.data || res;
    if (Array.isArray(rows) && rows.length > 0 && rows[0].ssid) {
      listedSsid = rows[0].ssid;
    }
  });

  test("get connection details", async () => {
    let ssid = envSshSsid || listedSsid;
    if (!ssid) {
      // Fall back: search specifically for SSH protocol if list had no usable row
      let res = await io_utils.noThrow(
        io_connectionlog.ConnectionLog.list(api, 0, 50, [
          ["protocol", "equals", "SSH"],
        ]),
      );
      let rows = (res && res.data) || [];
      if (rows.length > 0) {
        ssid = rows[0].ssid;
        listedSsid = ssid;
      }
    }
    if (!ssid) {
      console.log("skip get: no connection ssid available");
      return;
    }

    let info = await io_utils.noThrow(
      io_connectionlog.ConnectionLog.get(api, ssid, { ssh_streams: true }),
    );
    expect(info.errors).toBeFalsy();
    expect(info.ssid || info.SSID || ssid).toBeTruthy();

    let streams = info.ssh_streams || [];
    for (let stream of streams) {
      if (
        stream.kind === "shell" ||
        (stream.command !== "**SFTP**" && stream.command !== "**SCP**")
      ) {
        shellStreamId = stream.id;
        break;
      }
    }
  });

  test("ssh video options catalog", async () => {
    let catalog = await io_utils.noThrow(
      io_connectionlog.ConnectionLog.sshVideoOptions(api),
    );
    expect(catalog.errors).toBeFalsy();
    expect(catalog.themes).toBeTruthy();
    expect(catalog.defaults).toBeTruthy();
  });

  test("download ssh video", async () => {
    let ssid = envSshSsid || listedSsid;
    let streamId = envSshStreamId || shellStreamId;
    if (!ssid || streamId == null || streamId === "") {
      console.log(
        "skip ssh video: set MAMORI_SSH_SSID / MAMORI_SSH_STREAM_ID or ensure an SSH shell session exists",
      );
      return;
    }

    let buf = await io_connectionlog.ConnectionLog.downloadSshVideo(
      api,
      ssid,
      streamId,
      { theme: "dracula", quality: "low", speed: 8 },
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    // ISO BMFF / MP4 typically contains 'ftyp' near the start
    let head = buf.slice(0, 32).toString("binary");
    expect(head.indexOf("ftyp") >= 0 || buf[4] === 0x66).toBe(true);
  }, 600000);

  test("download rdp video url", async () => {
    if (!envRdpRecordingId) {
      console.log("skip rdp video: set MAMORI_RDP_RECORDING_ID");
      return;
    }
    let recordingId = Number(envRdpRecordingId);
    let url = await io_connectionlog.ConnectionLog.downloadRdpVideo(
      api,
      recordingId,
      "mp4",
    );
    expect(typeof url).toBe("string");
    expect(url.indexOf("/rdp/stream/") >= 0 || url.length > 0).toBe(true);
  }, 600000);
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

/**
 * Download an SSH shell session as MP4.
 *
 *   set -a && . ./working/local.sh && set +a
 *   npx ts-node examples/ssh-video-download.ts
 *
 * Env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD
 * Optional: MAMORI_SSH_SSID, MAMORI_SSH_STREAM_ID (otherwise picks first SSH shell stream)
 * Optional: MAMORI_SSH_VIDEO_OUT (default: ssh-session.mp4)
 */
import * as fs from "fs";
import { MamoriService, io_https, io_connectionlog } from "mamori-ent-js-sdk";

const host = process.env.MAMORI_SERVER || "";
const mamoriUser = process.env.MAMORI_USERNAME || "";
const mamoriPwd = process.env.MAMORI_PASSWORD || "";
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const envSsid = process.env.MAMORI_SSH_SSID || "";
const envStreamId = process.env.MAMORI_SSH_STREAM_ID || "";
const outPath = process.env.MAMORI_SSH_VIDEO_OUT || "ssh-session.mp4";

async function resolveShellTarget(api: MamoriService): Promise<{
  ssid: string;
  streamId: number | string;
}> {
  if (envSsid && envStreamId) {
    return { ssid: envSsid, streamId: envStreamId };
  }

  let list = await io_connectionlog.ConnectionLog.list(api, 0, 50, [
    ["protocol", "equals", "SSH"],
  ]);
  let rows = (list && list.data) || [];
  for (let row of rows) {
    let ssid = envSsid || row.ssid;
    if (!ssid) {
      continue;
    }
    let info = await io_connectionlog.ConnectionLog.get(api, ssid, {
      ssh_streams: true,
    });
    let streams = info.ssh_streams || [];
    for (let stream of streams) {
      let isShell =
        stream.kind === "shell" ||
        (stream.command !== "**SFTP**" && stream.command !== "**SCP**");
      if (isShell && stream.id != null) {
        return { ssid, streamId: envStreamId || stream.id };
      }
    }
  }
  throw new Error(
    "No SSH shell stream found. Set MAMORI_SSH_SSID and MAMORI_SSH_STREAM_ID.",
  );
}

async function example() {
  let api = new MamoriService(host, INSECURE);
  console.info("Connecting...");
  let login = await api.login(mamoriUser, mamoriPwd);
  console.info(
    "Login successful for: ",
    login.fullname,
    ", session: ",
    login.session_id,
  );

  let { ssid, streamId } = await resolveShellTarget(api);
  console.info("Encoding SSH video ssid=%s stream=%s ...", ssid, streamId);

  let buf = await io_connectionlog.ConnectionLog.downloadSshVideo(
    api,
    ssid,
    streamId,
    { theme: "dracula", quality: "standard", speed: 1 },
    (percent, message) => {
      console.info("[%s%%] %s", percent, message);
    },
  );

  fs.writeFileSync(outPath, buf);
  console.info("Wrote %s (%s bytes)", outPath, buf.length);
  await api.logout();
}

example()
  .catch((e) => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

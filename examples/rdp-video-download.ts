process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

/**
 * Request an RDP session recording download URL.
 *
 *   set -a && . ./working/local.sh && set +a
 *   MAMORI_RDP_RECORDING_ID=<id> npx ts-node examples/rdp-video-download.ts
 *
 * Env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD, MAMORI_RDP_RECORDING_ID
 * Optional: MAMORI_RDP_TOKEN_TYPE (default: mp4)
 */
import { MamoriService, io_https, io_connectionlog } from "mamori-ent-js-sdk";

const host = process.env.MAMORI_SERVER || "";
const mamoriUser = process.env.MAMORI_USERNAME || "";
const mamoriPwd = process.env.MAMORI_PASSWORD || "";
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const recordingId = process.env.MAMORI_RDP_RECORDING_ID || "";
const tokenType = process.env.MAMORI_RDP_TOKEN_TYPE || "mp4";

async function example() {
  if (!recordingId) {
    throw new Error("Set MAMORI_RDP_RECORDING_ID to an RDP connection/recording id.");
  }

  let api = new MamoriService(host, INSECURE);
  console.info("Connecting...");
  let login = await api.login(mamoriUser, mamoriPwd);
  console.info(
    "Login successful for: ",
    login.fullname,
    ", session: ",
    login.session_id,
  );

  console.info(
    "Requesting RDP video download for recording %s (%s)...",
    recordingId,
    tokenType,
  );

  let url = await io_connectionlog.ConnectionLog.downloadRdpVideo(
    api,
    Number(recordingId),
    tokenType,
    (message, percentage) => {
      if (percentage != null) {
        console.info("[%s%%] %s", percentage, message);
      } else {
        console.info("%s", message);
      }
    },
  );

  console.info("Download URL: %s", url);
  await api.logout();
}

example()
  .catch((e) => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

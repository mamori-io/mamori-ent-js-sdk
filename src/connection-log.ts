/*
 * Copyright (c) 2026 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService } from "./api";
import { prepareFilter } from "./utils";

export type SshVideoEncodeOptions = {
  theme?: string;
  font_size?: string | number;
  speed?: string | number;
  idle?: string | number;
  fps?: string | number;
  quality?: string;
  video_name?: string;
};

export type SshVideoProgressHandler = (
  percent: number,
  message: string,
) => void;

/**
 * Past Mamori connection/session recordings (connection log), including
 * SSH cast playback and SSH/RDP video download helpers.
 */
export class ConnectionLog {
  /**
   * Search connection log rows (DevExpress-style grid payload).
   * @param filter [["column","=","value"], ...]
   */
  public static list(
    api: MamoriService,
    from: number,
    to: number,
    filter?: any,
  ): Promise<any> {
    let filters = prepareFilter(filter);
    let payload: any = filter
      ? { skip: from, take: to, filter: filters }
      : { skip: from, take: to };
    return api.search_connection_log(payload);
  }

  /**
   * Fetch a single connection by session id (ssid).
   * Pass `{ ssh_streams: true }` to include SSH stream metadata (incl. kind).
   */
  public static get(
    api: MamoriService,
    ssid: string,
    opts?: { ssh_streams?: boolean },
  ): Promise<any> {
    return api.connection_info(ssid, opts || null);
  }

  /** Asciinema cast text (or filtered events) for an SSH session. */
  public static sshSessionLog(
    api: MamoriService,
    ssid: string,
    options: any = null,
  ): Promise<any> {
    return api.ssh_session_log(ssid, options);
  }

  /** Encode option catalog (themes, defaults, etc.). */
  public static sshVideoOptions(api: MamoriService): Promise<any> {
    return api.ssh_video_options();
  }

  /**
   * Encode an SSH shell stream to MP4 via SSE, then download the file bytes.
   */
  public static async downloadSshVideo(
    api: MamoriService,
    ssid: string,
    streamId: number | string,
    options: SshVideoEncodeOptions = {},
    onProgress?: SshVideoProgressHandler,
  ): Promise<Buffer> {
    let params: any = Object.assign({}, options, {
      stream_id: String(streamId),
    });

    let encodeUrl =
      "/v1/ssh/" + encodeURIComponent(ssid) + "/video/encode";

    let downloadUrl = await ConnectionLog.encodeSshVideoSse(
      api,
      encodeUrl,
      params,
      onProgress,
    );

    return api.callAPIBinary("GET", downloadUrl);
  }

  /**
   * Request an RDP recording download URL (existing token + WebSocket flow).
   * @returns Absolute URL under `/rdp/stream/...`
   */
  public static async downloadRdpVideo(
    api: MamoriService,
    recordingId: number,
    tokenType: string = "mp4",
    onProgress?: (message: string, percentage?: number) => void,
  ): Promise<string> {
    let token = await api.get_remote_desktop_download_token(
      recordingId,
      tokenType,
    );
    if (!token) {
      throw new Error("Session recording is not available");
    }
    // API may return a bare token string or an object
    let tokenStr =
      typeof token === "string"
        ? token
        : token.token || token.download_token || String(token);
    return api.get_remote_desktop_download_link(tokenStr, onProgress);
  }

  private static encodeSshVideoSse(
    api: MamoriService,
    encodeUrl: string,
    params: any,
    onProgress?: SshVideoProgressHandler,
  ): Promise<string> {
    return api.callAPIStream("GET", encodeUrl, params).then((stream) => {
      return new Promise<string>((resolve, reject) => {
        let buffer = "";
        let settled = false;

        let finish = (err: Error | null, url?: string) => {
          if (settled) {
            return;
          }
          settled = true;
          if (err) {
            reject(err);
          } else {
            resolve(url as string);
          }
        };

        let handleEvent = (raw: string) => {
          let data: any;
          try {
            data = JSON.parse(raw);
          } catch (_e) {
            return;
          }
          if (data.error) {
            finish(new Error(String(data.error)));
            return;
          }
          if (
            typeof data.percent === "number" &&
            data.message &&
            onProgress
          ) {
            onProgress(data.percent, data.message);
          }
          if (data.done && data.url) {
            finish(null, data.url);
          }
        };

        let consume = (chunk: string) => {
          buffer += chunk;
          let parts = buffer.split("\n");
          buffer = parts.pop() || "";
          for (let line of parts) {
            let trimmed = line.replace(/\r$/, "");
            if (trimmed.indexOf("data:") === 0) {
              handleEvent(trimmed.substring(5).trim());
            }
          }
        };

        stream.on("data", (chunk: Buffer | string) => {
          consume(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
        });
        stream.on("end", () => {
          if (buffer.trim()) {
            consume("\n");
          }
          if (!settled) {
            finish(new Error("SSH video encode ended without a download URL"));
          }
        });
        stream.on("error", (err: Error) => {
          finish(err);
        });
      });
    });
  }
}

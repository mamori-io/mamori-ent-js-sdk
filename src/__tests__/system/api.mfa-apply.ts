/**
 * HTTP scoped MFA apply APIs (ch10588).
 *
 * Pattern: admin creates user / sets MFA / reads catalogs; subject session for
 * self list/enroll and non-admin deny; admin re-checks SYS MFA applies.
 *
 * Env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD
 */
import { MamoriService } from "../../api";
import * as crypto from "crypto";
import { User, MFA_PROVIDER, MFA_SCOPES, MFA_APPLY } from "../../user";
import { noThrow, ignoreError } from "../../utils";
import {
  INSECURE_HTTPS,
  assertUserMfaApplies,
  authProviderRows,
  col,
  rowsOf,
  withSubjectSession,
} from "../../__utility__/auth-test-harness";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const granteepw = "Test1234!";

function generateTOTP(secret: string): string {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const outputBytes: number[] = [];
  for (let i = 0; i < secret.length; i++) {
    const index = base32Chars.indexOf(secret[i].toUpperCase());
    if (index === -1) {
      continue;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      outputBytes.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const key = Buffer.from(outputBytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);
  const hash = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
}

function assertApiOk(label: string, r: unknown): void {
  if (r == null || typeof r !== "object") {
    throw new Error(`${label}: unexpected response: ` + JSON.stringify(r));
  }
  if ((r as any).errors === true) {
    throw new Error(`${label} failed: ` + JSON.stringify(r));
  }
}

function assertApiFailed(label: string, r: unknown): void {
  if (r != null && typeof r === "object" && (r as any).errors === true) {
    return;
  }
  if (
    r != null &&
    typeof r === "object" &&
    ((r as any).error || (r as any).status >= 400)
  ) {
    return;
  }
  throw new Error(`${label}: expected failure, got: ` + JSON.stringify(r));
}

describe("scoped MFA HTTP API tests" + (testbatch ? " " + testbatch : ""), () => {
  let api: MamoriService;

  beforeAll(async () => {
    if (!host || !username || !password) {
      throw new Error("Missing MAMORI_SERVER / MAMORI_USERNAME / MAMORI_PASSWORD");
    }
    api = new MamoriService(host, INSECURE_HTTPS);
    await api.login(username, password);
  });

  afterAll(async () => {
    await api.logout();
  });

  async function createValidatedUser(suffix: string): Promise<User> {
    const testUser = ("mfa_http_" + suffix + "_" + testbatch)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    const k = new User(testUser)
      .withEmail(testUser + "@ace.com")
      .withFullName("MFA HTTP " + suffix);
    await ignoreError(k.delete(api));
    expect(await noThrow(k.create(api, granteepw))).toSucceed();
    expect(
      await noThrow(api.select("ALTER USER " + testUser + " SET VALIDATED = TRUE")),
    ).toSucceed();
    return k;
  }

  test("admin HTTP set + list_user_mfa_apply + SYS catalog", async () => {
    const k = await createValidatedUser("admin_list");
    try {
      const setResult = await noThrow(
        k.setScopedMfaHttp(api, MFA_PROVIDER.PUSHTOTP, MFA_SCOPES),
      );
      assertApiOk("set_user_scoped_mfa", setResult);

      const listed = await noThrow(k.listUserMfaApply(api));
      assertApiOk("list_user_mfa_apply", listed);
      const rows = rowsOf(listed);
      const applies = rows
        .map((r) => String(r.mfa_apply || r.MFA_APPLY || "").trim())
        .filter(Boolean)
        .sort();
      expect(applies).toEqual(
        [MFA_APPLY.PORTAL_LOCAL_AUTH, MFA_APPLY.RESOURCE_ACCESS].sort(),
      );

      await assertUserMfaApplies(api, k.username, [
        MFA_APPLY.PORTAL_LOCAL_AUTH,
        MFA_APPLY.RESOURCE_ACCESS,
      ]);
    } finally {
      await ignoreError(k.delete(api));
    }
  });

  test("self list_my_mfa_apply and enroll_scoped_mfa after QR register", async () => {
    const k = await createValidatedUser("self");
    const userApi = new MamoriService(host, INSECURE_HTTPS);
    try {
      const setResult = await noThrow(
        k.setScopedMFA(api, MFA_PROVIDER.PUSHTOTP, MFA_SCOPES),
      );
      assertApiOk("SET_USER_SCOPED_MFA", setResult);

      const setRows = Array.isArray(setResult) ? setResult : [];
      const guid =
        (setRows[0] && (setRows[0].guid || setRows[0].GUID)) ||
        (setResult as any).guid;
      expect(guid).toBeTruthy();

      const qr = await noThrow(api.get_qr_code(String(guid)));
      assertApiOk("get_qr_code", qr);
      expect((qr as any).qr_code).toBeTruthy();
      expect((qr as any).qr_code).not.toBe("Nothing to see here");

      const qrCode = String((qr as any).qr_code || "");
      const secretMatch = qrCode.match(/secret=([^&]+)/i);
      const totpSecret = secretMatch ? decodeURIComponent(secretMatch[1]) : "";
      expect(totpSecret.length).toBeGreaterThan(0);

      const loginResult = await noThrow(
        userApi.login(k.username, granteepw, generateTOTP(totpSecret)),
      );
      expect(loginResult && (loginResult as any).errors).not.toBe(true);
      expect((loginResult as any).username).toBe(k.username);

      const mine = await noThrow(userApi.list_my_mfa_apply());
      assertApiOk("list_my_mfa_apply", mine);
      const rows = rowsOf(mine);
      expect(rows.length).toBeGreaterThanOrEqual(1);

      const enroll = await noThrow(userApi.enroll_scoped_mfa());
      assertApiOk("enroll_scoped_mfa", enroll);

      // Admin catalog: scopes still present after subject self-service
      await assertUserMfaApplies(api, k.username, [
        MFA_APPLY.PORTAL_LOCAL_AUTH,
        MFA_APPLY.RESOURCE_ACCESS,
      ]);
    } finally {
      await ignoreError(userApi.logout());
      await ignoreError(k.delete(api));
    }
  });

  test("non-admin HTTP set/delete/reset scoped MFA fails", async () => {
    const k = await createValidatedUser("http_priv");
    try {
      await withSubjectSession(host, k.username, granteepw, async (userApi) => {
        assertApiFailed(
          "non-admin set_user_scoped_mfa",
          await noThrow(
            userApi.set_user_scoped_mfa(k.username, MFA_PROVIDER.PUSHTOTP, [
              MFA_APPLY.PORTAL_LOCAL_AUTH,
            ]),
          ),
        );
        assertApiFailed(
          "non-admin delete_user_scoped_mfa",
          await noThrow(
            userApi.delete_user_scoped_mfa(k.username, [
              MFA_APPLY.PORTAL_LOCAL_AUTH,
            ]),
          ),
        );
        assertApiFailed(
          "non-admin reset_user_scoped_mfa",
          await noThrow(
            userApi.reset_user_scoped_mfa(k.username, MFA_PROVIDER.PUSHTOTP, [
              MFA_APPLY.PORTAL_LOCAL_AUTH,
            ]),
          ),
        );
      });

      // Admin: no MFA rows created by denied subject calls
      const rows = await authProviderRows(api, k.username);
      const mfaScoped = rows.filter((r) => {
        const provider = String(col(r, "provider_name") || "").toLowerCase();
        const apply = String(col(r, "mfa_apply") || "").trim();
        return provider !== "password" && apply.length > 0;
      });
      expect(mfaScoped.length).toBe(0);
    } finally {
      await ignoreError(k.delete(api));
    }
  });
});

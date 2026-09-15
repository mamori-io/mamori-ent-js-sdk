/**
 * Non-admin GET /v1/roles/auth/systems regression (ch10588 catalog_grantee fix).
 *
 * Pattern: admin creates validated user; subject calls credentials API;
 * admin confirms call did not error and SYS catalog is still queryable.
 *
 * Env: MAMORI_SERVER, MAMORI_USERNAME, MAMORI_PASSWORD
 */
import { MamoriService, io_permission } from "../../api";
import { User } from "../../user";
import { noThrow, ignoreError } from "../../utils";
import {
  INSECURE_HTTPS,
  rowsOf,
  withSubjectSession,
} from "../../__utility__/auth-test-harness";
import { selectQuery } from "../../__utility__/test-helper";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const granteepw = "Test1234!";

describe("roles auth systems (non-admin)" + (testbatch ? " " + testbatch : ""), () => {
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

  test("non-admin get_role_authorization_by_system succeeds", async () => {
    const testUser =
      ("mfa_ras_" + testbatch).toLowerCase().replace(/[^a-z0-9_]/g, "_") ||
      "mfa_ras_u";
    const k = new User(testUser)
      .withEmail(testUser + "@ace.com")
      .withFullName("Roles Auth Sys");
    try {
      await ignoreError(k.delete(api));
      expect(await noThrow(k.create(api, granteepw))).toSucceed();
      expect(
        await noThrow(
          api.select("ALTER USER " + testUser + " SET VALIDATED = TRUE"),
        ),
      ).toSucceed();

      await withSubjectSession(host, k.username, granteepw, async (userApi) => {
        const res = await noThrow(
          userApi.get_role_authorization_by_system({ grantee: k.username }),
        );
        expect(res).toBeTruthy();
        expect((res as any).errors).not.toBe(true);
        const msg = JSON.stringify(res);
        expect(msg.toLowerCase().indexOf("catalog_grantee")).toBe(-1);
        expect(
          Array.isArray(res) ||
            Array.isArray((res as any).data) ||
            Array.isArray((res as any).rows),
        ).toBe(true);
      });

      // Admin: permissions search / catalog still healthy for this grantee
      const perm = await noThrow(
        io_permission.Permissions.list(api, [["grantee", "=", k.username]]),
      );
      expect(perm && (perm as any).errors).not.toBe(true);
      expect(rowsOf(perm).length).toBeGreaterThanOrEqual(0);

      const users = await selectQuery(
        api,
        "SELECT username FROM SYS.ALL_USERS WHERE lower(username) = lower('" +
          k.username.replace(/'/g, "''") +
          "')",
      );
      expect(users && users.errors).toBeFalsy();
      expect(Array.isArray(users) && users.length).toBe(1);
    } finally {
      await ignoreError(k.delete(api));
    }
  });
});

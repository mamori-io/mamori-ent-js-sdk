import { MamoriService } from "../../api";
import * as https from "https";
import { noThrow, sqlEscape } from "../../utils";
import { selectQuery } from "../../__utility__/test-helper";
import "../../__utility__/jest/error_matcher";

const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const adUser = process.env.AD_USER || process.env.MAMORI_DIRECTORY_USERNAME || "";
const adPassword = process.env.AD_USER_PASSWORD || "";
const adProvider =
  process.env.AD_AUTH_PROVIDER || process.env.MAMORI_DIRECTORY_PROVIDER || "";

const INSECURE = new https.Agent({ rejectUnauthorized: false });
const ldapTest = adUser && adPassword && adProvider ? test : test.skip;

function sqlLiteral(value: string): string {
  return "'" + sqlEscape(value) + "'";
}

function assertRows(label: string, r: unknown): asserts r is any[] {
  if (r == null || typeof r !== "object") {
    throw new Error(`${label}: unexpected response: ` + JSON.stringify(r));
  }
  const o = r as Record<string, unknown>;
  if (o.errors === true) {
    throw new Error(`${label} failed: ` + JSON.stringify(r));
  }
  if (!Array.isArray(r)) {
    throw new Error(`${label}: expected array result, got: ` + JSON.stringify(r));
  }
}

describe("LDAP API tests", () => {
  let api: MamoriService;

  beforeAll(async () => {
    if (!adUser || !adPassword || !adProvider) {
      return;
    }
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
  });

  afterAll(async () => {
    if (api) {
      await api.logout();
    }
  });

  ldapTest("VALIDATE AUTHENTICATION rejects a wrong password", async () => {
    await expect(async () => {
      await api.select(
        "VALIDATE AUTHENTICATION USERNAME " +
          sqlLiteral(adUser) +
          " PASSWORD " +
          sqlLiteral("not-the-directory-password") +
          " WITH PROVIDER " +
          sqlLiteral(adProvider)
      );
    }).rejects.toThrow();
  });

  ldapTest("LDAP_FIND_USER finds the directory user", async () => {
    const r = await noThrow(api.call("LDAP_FIND_USER", adUser));
    assertRows("LDAP_FIND_USER", r);
    expect(r.length).toBeGreaterThan(0);
    const row = r[0];
    const name = String(row.shortname || row.shortName || "").toLowerCase();
    const dn = String(row.dn || "").toLowerCase();
    expect(name === adUser.toLowerCase() || dn.includes(adUser.toLowerCase())).toBe(
      true
    );
    if (row.provider) {
      expect(String(row.provider).toLowerCase()).toContain(
        adProvider.toLowerCase()
      );
    }
  });

  ldapTest("CALL LDAP_FIND_USER via SQL finds the directory user", async () => {
    const rows = await selectQuery(
      api,
      "CALL LDAP_FIND_USER(" + sqlLiteral(adUser) + ")"
    );
    assertRows("CALL LDAP_FIND_USER", rows);
    expect(rows.length).toBeGreaterThan(0);
  });

  ldapTest("LDAP_FIND_USER returns no row for an unknown account", async () => {
    const r = await noThrow(
      api.call("LDAP_FIND_USER", "no-such-ldap-user-zzxxyy-mamori-test")
    );
    assertRows("LDAP_FIND_USER missing", r);
    expect(r.length).toBe(0);
  });

  // These fail on Hub that concatenates the username into the LDAP filter
  // unescaped (* remains a wildcard / ) closes the assertion). They pass once
  // %USERNAME% is RFC 4515-escaped (literal * and ) match no directory user).
  ldapTest("LDAP_FIND_USER does not treat * as an LDAP wildcard", async () => {
    const r = await noThrow(api.call("LDAP_FIND_USER", "*"));
    assertRows("LDAP_FIND_USER *", r);
    expect(r.length).toBe(0);
  });

  ldapTest(
    "LDAP_FIND_USER does not close the filter with a trailing )(objectClass=*",
    async () => {
      const injected = adUser + ")(objectClass=*";
      const r = await noThrow(api.call("LDAP_FIND_USER", injected));
      assertRows("LDAP_FIND_USER filter breakout", r);
      expect(r.length).toBe(0);
    }
  );

  ldapTest(
    "LDAP_FIND_USER does not match every entry via *)(objectClass=*",
    async () => {
      const r = await noThrow(api.call("LDAP_FIND_USER", "*)(objectClass=*"));
      assertRows("LDAP_FIND_USER objectClass injection", r);
      expect(r.length).toBe(0);
    }
  );
});

import { MamoriService } from '../../api';
import * as https from 'https';
import { User, MFA_PROVIDER, MFA_SCOPES, MFA_APPLY } from '../../user';
import { noThrow, ignoreError } from '../../utils';
import {
    authProviderRows as harnessAuthProviderRows,
    col as harnessCol,
} from '../../__utility__/auth-test-harness';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

const SCOPED_MFA_PROVIDERS: Array<MFA_PROVIDER.PUSHTOTP | MFA_PROVIDER.PUSHMOBILE> = [
    MFA_PROVIDER.PUSHTOTP,
    MFA_PROVIDER.PUSHMOBILE,
];

const MFA_SCOPE_LIST = MFA_SCOPES.map(String);

/**
 * `api.select` / CALL success is typically an array (possibly empty). Failures from noThrow have errors: true.
 */
function assertSelectOk(label: string, r: unknown): void {
    if (r == null || typeof r !== "object") {
        throw new Error(`${label}: unexpected response: ` + JSON.stringify(r));
    }
    const o = r as Record<string, unknown>;
    if (o.errors === true) {
        throw new Error(`${label} failed: ` + JSON.stringify(r));
    }
}

function assertSelectFailed(label: string, r: unknown): void {
    if (r == null) {
        throw new Error(`${label}: expected failure, got null`);
    }
    if (typeof r === "object" && (r as any).errors === true) {
        return;
    }
    if (typeof r === "object" && (r as any).error) {
        return;
    }
    throw new Error(`${label}: expected failure, got success: ` + JSON.stringify(r));
}

function col(row: any, name: string): any {
    return harnessCol(row, name);
}

async function authProviderRows(api: MamoriService, userName: string): Promise<any[]> {
    return harnessAuthProviderRows(api, userName);
}

function mfaRowsForProvider(rows: any[], provider: string): any[] {
    return rows.filter((r) => String(col(r, "provider_name") || "").toLowerCase() === provider.toLowerCase());
}

function passwordRows(rows: any[]): any[] {
    return rows.filter((r) => String(col(r, "provider_name") || "").toLowerCase() === "password");
}

function applyValues(rows: any[]): string[] {
    return rows
        .map((r) => String(col(r, "mfa_apply") || "").trim())
        .filter((a) => a.length > 0)
        .sort();
}

function assertScopedMfaRows(rows: any[], provider: string) {
    const mfa = mfaRowsForProvider(rows, provider);
    expect(mfa.length).toBe(2);
    expect(applyValues(mfa)).toEqual([...MFA_SCOPE_LIST].sort());
    for (const r of mfa) {
        const props = col(r, "provider_user_properties");
        expect(props != null && String(props).trim() !== "").toBe(true);
    }
    expect(passwordRows(rows).length).toBeGreaterThanOrEqual(1);
}

/** After ALTER USER RESET AUTHENTICATION, scopes remain but secrets/options may be cleared. */
function assertScopedMfaApplies(rows: any[], provider: string) {
    const mfa = mfaRowsForProvider(rows, provider);
    expect(mfa.length).toBe(2);
    expect(applyValues(mfa)).toEqual([...MFA_SCOPE_LIST].sort());
    expect(passwordRows(rows).length).toBeGreaterThanOrEqual(1);
}

describe("mamori user scoped MFA tests", () => {
    let api: MamoriService;

    const granteepw = "Test1234!";

    beforeAll(async () => {
        if (!host || !username || !password) {
            throw new Error(
                "Missing MAMORI_SERVER / MAMORI_USERNAME / MAMORI_PASSWORD. " +
                    "Source working/local.sh (or set them in the environment) before running tests.",
            );
        }

        api = new MamoriService(host, INSECURE);
        try {
            await api.login(username, password);
        } catch (e: any) {
            const status = e && e.response && e.response.status;
            throw new Error(
                `Admin login failed (${status || e.message}) for user '${username}' at ${host}. ` +
                    `Check credentials from working/local.sh — MFA tests never ran.`,
            );
        }
    });

    afterAll(async () => {
        await api.logout();
    });

    async function createValidatedUser(suffix: string, providerHint?: string): Promise<User> {
        const hint = providerHint || "u";
        const testUser = ("mfa_sc_" + hint + "_" + suffix + "_" + testbatch).toLowerCase().replace(/[^a-z0-9_]/g, "_");
        const k = new User(testUser).withEmail(testUser + "@ace.com").withFullName("Scoped MFA " + hint);
        await ignoreError(k.delete(api));
        const createResult = await noThrow(k.create(api, granteepw));
        expect(createResult).toSucceed();
        const activateResult = await noThrow(api.select("ALTER USER " + testUser + " SET VALIDATED = TRUE"));
        expect(activateResult).toSucceed();
        return k;
    }

    for (const provider of SCOPED_MFA_PROVIDERS) {
        describe(`provider ${provider}`, () => {
            test(`assign ${provider} creates portal_local_auth and resource_access rows`, async () => {
                const k = await createValidatedUser("assign", provider);
                try {
                    const setResult = await noThrow(k.setScopedMFA(api, provider, MFA_SCOPES));
                    assertSelectOk("SET_USER_SCOPED_MFA", setResult);

                    const rows = await authProviderRows(api, k.username);
                    assertScopedMfaRows(rows, provider);
                } finally {
                    await ignoreError(k.delete(api));
                }
            });

            test(`reset ${provider} keeps scoped MFA rows`, async () => {
                const k = await createValidatedUser("reset", provider);
                try {
                    const setResult = await noThrow(k.setScopedMFA(api, provider, MFA_SCOPES));
                    assertSelectOk("SET_USER_SCOPED_MFA", setResult);

                    const before = await authProviderRows(api, k.username);
                    assertScopedMfaRows(before, provider);

                    const resetResult = await noThrow(k.resetScopedMFA(api, provider, MFA_SCOPES));
                    assertSelectOk("RESET_USER_SCOPED_MFA", resetResult);

                    const after = await authProviderRows(api, k.username);
                    assertScopedMfaRows(after, provider);
                } finally {
                    await ignoreError(k.delete(api));
                }
            });

            test(`remove ${provider} deletes scoped MFA rows and keeps password`, async () => {
                const k = await createValidatedUser("remove", provider);
                try {
                    const setResult = await noThrow(k.setScopedMFA(api, provider, MFA_SCOPES));
                    assertSelectOk("SET_USER_SCOPED_MFA", setResult);

                    const deleteResult = await noThrow(k.deleteScopedMFA(api, MFA_SCOPES));
                    assertSelectOk("DELETE_USER_SCOPED_MFA", deleteResult);

                    const rows = await authProviderRows(api, k.username);
                    expect(mfaRowsForProvider(rows, provider).length).toBe(0);
                    expect(passwordRows(rows).length).toBeGreaterThanOrEqual(1);
                    expect(applyValues(rows).length).toBe(0);
                } finally {
                    await ignoreError(k.delete(api));
                }
            });

            test(`ALTER USER RESET AUTHENTICATION keeps ${provider} MFA_APPLY scopes`, async () => {
                const k = await createValidatedUser("alter_reset", provider);
                try {
                    const setResult = await noThrow(k.setScopedMFA(api, provider, MFA_SCOPES));
                    assertSelectOk("SET_USER_SCOPED_MFA", setResult);
                    assertScopedMfaRows(await authProviderRows(api, k.username), provider);

                    const alterReset = await noThrow(
                        api.select("ALTER USER " + k.username + " RESET AUTHENTICATION"),
                    );
                    assertSelectOk("ALTER USER RESET AUTHENTICATION", alterReset);

                    const after = await authProviderRows(api, k.username);
                    assertScopedMfaApplies(after, provider);
                } finally {
                    await ignoreError(k.delete(api));
                }
            });
        });
    }

    test("assign portal_oauth only creates one scoped row", async () => {
        const k = await createValidatedUser("oauth_only", "oauth");
        try {
            const setResult = await noThrow(
                k.setScopedMFA(api, MFA_PROVIDER.PUSHTOTP, [MFA_APPLY.PORTAL_OAUTH]),
            );
            assertSelectOk("SET_USER_SCOPED_MFA portal_oauth", setResult);

            const rows = await authProviderRows(api, k.username);
            const mfa = mfaRowsForProvider(rows, MFA_PROVIDER.PUSHTOTP);
            expect(mfa.length).toBe(1);
            expect(applyValues(mfa)).toEqual([MFA_APPLY.PORTAL_OAUTH]);
        } finally {
            await ignoreError(k.delete(api));
        }
    });

    test("non-admin cannot SET/DELETE/RESET scoped MFA", async () => {
        const k = await createValidatedUser("priv_deny", "priv");
        const userApi = new MamoriService(host, INSECURE);
        try {
            await userApi.login(k.username, granteepw);

            const setDenied = await noThrow(
                userApi.select(
                    "CALL SYSCS_UTIL.SET_USER_SCOPED_MFA('" +
                        k.username.replace(/'/g, "''") +
                        "', 'pushtotp', 'portal_local_auth,resource_access')",
                ),
            );
            assertSelectFailed("non-admin SET_USER_SCOPED_MFA", setDenied);

            const delDenied = await noThrow(
                userApi.select(
                    "CALL SYSCS_UTIL.DELETE_USER_SCOPED_MFA('" +
                        k.username.replace(/'/g, "''") +
                        "', 'portal_local_auth,resource_access')",
                ),
            );
            assertSelectFailed("non-admin DELETE_USER_SCOPED_MFA", delDenied);

            const resetDenied = await noThrow(
                userApi.select(
                    "CALL SYSCS_UTIL.RESET_USER_SCOPED_MFA('" +
                        k.username.replace(/'/g, "''") +
                        "', 'pushtotp', 'portal_local_auth,resource_access')",
                ),
            );
            assertSelectFailed("non-admin RESET_USER_SCOPED_MFA", resetDenied);
        } finally {
            await ignoreError(userApi.logout());
            await ignoreError(k.delete(api));
        }
    });

    test("second SET for same applies replaces provider (upsert)", async () => {
        const k = await createValidatedUser("dup_apply", "dup");
        try {
            const first = await noThrow(k.setScopedMFA(api, MFA_PROVIDER.PUSHTOTP, MFA_SCOPES));
            assertSelectOk("SET pushtotp", first);
            assertScopedMfaRows(await authProviderRows(api, k.username), MFA_PROVIDER.PUSHTOTP);

            const second = await noThrow(k.setScopedMFA(api, MFA_PROVIDER.PUSHMOBILE, MFA_SCOPES));
            assertSelectOk("SET pushmobile overwrite", second);

            const rows = await authProviderRows(api, k.username);
            expect(mfaRowsForProvider(rows, MFA_PROVIDER.PUSHTOTP).length).toBe(0);
            assertScopedMfaRows(rows, MFA_PROVIDER.PUSHMOBILE);
        } finally {
            await ignoreError(k.delete(api));
        }
    });
});

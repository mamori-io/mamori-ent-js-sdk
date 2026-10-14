import { MamoriService } from '../../api';
import * as https from 'https';
import { User, MFA_PROVIDER } from '../../user';
import { Tag } from '../../tag';
import { DatasourcePermission, DB_PERMISSION, TIME_UNIT } from '../../permission';
import { handleAPIException, noThrow, ignoreError, addUniqueExtension } from '../../utils';
import * as helper from '../../__utility__/test-helper';
import {
    PORTAL_LOGIN_APPLICATION,
    col,
    listConnectionLogForUser,
    rowsOf,
} from '../../__utility__/auth-test-harness';
import '../../__utility__/jest/error_matcher';
import * as crypto from 'crypto';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const host2 = process.env.MAMORI_SERVER2 || '';
const username2 = process.env.MAMORI_USERNAME2 || '';
const password2 = process.env.MAMORI_PASSWORD2 || '';
/** Runs only when MAMORI_SERVER2, MAMORI_USERNAME2, and MAMORI_PASSWORD2 are all set. */
const dualServerTest = host2 && username2 && password2 ? test : test.skip;

const INSECURE = new https.Agent({ rejectUnauthorized: false });

/**
 * `noThrow(api.call(...))` resolves to a JSON array on success; on HTTP/API failure axios rejects and
 * {@link handleAPIException} returns `{ errors: true, ... }` (not `error`). Use this so failures fail fast with detail.
 */
function assertProcedureCallOk(label: string, r: unknown): asserts r is any[] {
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

/**
 * Generate a TOTP code from a base32-encoded secret
 * @param secret Base32-encoded secret string
 * @returns 6-digit TOTP code as string
 */
/** hhmmss suffix so PushTOTP MFA cache cannot reuse a prior run for the same username. */
function hhmmss(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function generateTOTP(secret: string): string {
    // Base32 decoding
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let outputBytes: number[] = [];
    
    for (let i = 0; i < secret.length; i++) {
        const char = secret[i];
        const index = base32Chars.indexOf(char.toUpperCase());
        if (index === -1) continue;
        
        value = (value << 5) | index;
        bits += 5;
        
        if (bits >= 8) {
            outputBytes.push((value >> (bits - 8)) & 0xFF);
            bits -= 8;
        }
    }
    
    const output = Buffer.from(outputBytes);
    
    // Calculate time counter (30 second intervals)
    const timeStep = 30;
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    
    // Convert counter to 8-byte buffer (big-endian)
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(0, 0);
    counterBuffer.writeUInt32BE(counter, 4);
    
    // Compute HMAC-SHA1
    const hmac = crypto.createHmac('sha1', output);
    hmac.update(counterBuffer);
    const hash = hmac.digest();
    
    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0F;
    const binary = ((hash[offset] & 0x7F) << 24) |
                   ((hash[offset + 1] & 0xFF) << 16) |
                   ((hash[offset + 2] & 0xFF) << 8) |
                   (hash[offset + 3] & 0xFF);
    
    // Generate 6-digit code
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}

/**
 * Deletes any existing user, creates with password, sets VALIDATED, and verifies by logging in.
 * @returns The {@link User} handle for follow-up (e.g. delete).
 */
async function createActiveValidatedUser(
    api: MamoriService,
    userName: string,
    password: string,
    email: string,
    fullName: string,
): Promise<User> {
    const k = new User(userName).withEmail(email).withFullName(fullName);
    await ignoreError(k.delete(api));
    const createResult = await noThrow(k.create(api, password));
    expect(createResult).toSucceed();
    const loginResult = await noThrow(k.validateLogin(api, password));
    expect(loginResult.username).toBe(userName);
    return k;
}

describe("mamori user tests", () => {

    let api: MamoriService;
    let grantee = "test_user_" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!98712_vdQ'}D"

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

    test('mamori user 01', async () => {
        let k = new User(grantee).withEmail(grantee + "@ace.com").withFullName("Test User");
        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api, granteepw));
        expect(res).toSucceed();
        let x = await noThrow(User.get(api, grantee));
        expect(x.username).toBe(grantee);
        //Test connection
        let apiAsAPIUser: MamoriService = new MamoriService(host, INSECURE);
        let x4 = await noThrow(apiAsAPIUser.login(grantee, granteepw));
        expect(x4.username).toBe(grantee);
        ignoreError(apiAsAPIUser.logout());
        //Update email
        k.email = "testit@test.com";
        let x2 = await noThrow(k.update(api));
        expect(x2).toSucceed();
        let x3 = await noThrow(User.get(api, grantee));
        expect(x3.email).toBe("testit@test.com");
        let d = await noThrow(k.delete(api));
        expect(res).toSucceed();
    });

    //spaces, periods, dashes, and underscores
    test('mamori user 02 - special characters', async () => {
        let uname = grantee + ".-_TEST";
        let k = new User(uname).withEmail(grantee + "@ace.com").withFullName("Test User");
        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api, granteepw));
        expect(res).toSucceed();
        let x = await noThrow(User.get(api, uname));
        expect(x.username).toBe(uname);
        //Test connection
        let apiAsAPIUser: MamoriService = new MamoriService(host, INSECURE);
        let x4 = await noThrow(apiAsAPIUser.login(uname, granteepw));
        expect(x4.username).toBe(uname.toLowerCase());
        ignoreError(apiAsAPIUser.logout());
        //Update email
        k.email = "testit@test.com";
        let x2 = await noThrow(k.update(api));
        expect(x2).toSucceed();
        let x3 = await noThrow(User.get(api, uname));
        expect(x3.email).toBe("testit@test.com");
        let d = await noThrow(k.delete(api));
        expect(res).toSucceed();
    });

    test('mamori user 03 - disable then enable account', async () => {
        let uname = (grantee + "_disable_enable").toLowerCase();
        let k = new User(uname).withEmail(uname + "@ace.com").withFullName("Disable Enable User");
        await ignoreError(k.delete(api));

        let createResult = await noThrow(k.create(api, granteepw));
        expect(createResult).toSucceed();

        let disableResult = await noThrow(k.disableAccount(api));
        expect(disableResult).toSucceed();

        let apiAsUser = new MamoriService(host, INSECURE);
        let disabledLogin = await noThrow(apiAsUser.login(uname, granteepw));
        expect(disabledLogin.errors).toBe(true);
        await ignoreError(apiAsUser.logout());

        let enableResult = await noThrow(k.enableAccount(api));
        expect(enableResult).toSucceed();

        let apiAsEnabledUser = new MamoriService(host, INSECURE);
        let enabledLogin = await noThrow(apiAsEnabledUser.login(uname, granteepw));
        expect(enabledLogin.username).toBe(uname);
        await ignoreError(apiAsEnabledUser.logout());

        let unlockResult = await noThrow(k.unlockAccount(api));
        expect(unlockResult).toSucceed();

        let deleteResult = await noThrow(k.delete(api));
        expect(deleteResult).toSucceed();
    });

    test('mamori user 04 - MFA export restore', async () => {
        // Step 1: Create a new user (hhmmss avoids PushTOTP MFA cache reuse across runs)
        let testUser = (grantee + "_mfa_" + hhmmss()).toLowerCase();
        let k = new User(testUser).withEmail(testUser + "@ace.com").withFullName("MFA Test User");
        await ignoreError(k.delete(api));
        let createResult = await noThrow(k.create(api, granteepw));
        expect(createResult).toSucceed();

        // Step 1.5: Activate the user before setting MFA provider
        let activateResult = await noThrow(api.select("ALTER USER " + testUser + " SET VALIDATED = TRUE"));
        expect(activateResult).toSucceed();        
        // Step 2: Set MFA provider to PUSHTOTP with a known TOTP secret for testing
        // Using a known base32-encoded secret: must be at least 32 chars (160 bits) per RFC 4648
        // This is a 32-character base32 secret that decodes to 20 bytes (160 bits)
        let knownTotpSecret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
        let setMFASQL = "ALTER USER "+testUser+" AUTHENTICATED BY pushtotp OPTIONS(SECRET '"+knownTotpSecret+"')";
        let setMfaResult = await noThrow(api.select(setMFASQL));
        expect(setMfaResult).toSucceed();
        
        // Step 2.7: Generate TOTP code and login with it to verify the secret works
        {
            let totpCode = generateTOTP(knownTotpSecret);
            let apiAsTestUserWithTOTP: MamoriService = new MamoriService(host, INSECURE);
            let loginWithTotpResult = await noThrow(apiAsTestUserWithTOTP.login(testUser, granteepw, totpCode));
            expect(loginWithTotpResult.username).toBe(testUser);
            await ignoreError(apiAsTestUserWithTOTP.logout());
        }
        
        // Step 3: Create AES Encryption Key
        let aesKeyName = addUniqueExtension("test_user_03_aes_key_" + testbatch);
        await helper.EncryptionKey.setupAESEncryptionKey(api, aesKeyName);

        // Step 3.5: Activate the user before exporting options
        let exportResult = await noThrow(api.call("EXPORT_USER_AUTH_PROVIDER_OPTIONS_EX", testUser, "pushtotp", aesKeyName));
        assertProcedureCallOk("EXPORT_USER_AUTH_PROVIDER_OPTIONS_EX", exportResult);
        expect(exportResult.length).toBeGreaterThan(0);
        let exportedData = exportResult[0];
        expect(exportedData.value).toBeDefined();
        let encryptedValue = exportedData.value;

        // Step 5: Clear/remove the MFA provider to simulate it being deleted
        let clearMfaResult = await noThrow(k.setMFAProvider(api, MFA_PROVIDER.NONE));
        expect(clearMfaResult).toSucceed();

        // Verify MFA is cleared
        let userAfterClear = await noThrow(User.get(api, testUser));
        expect(userAfterClear).toBeDefined();

        // Step 6: Restore user auth provider options
        let restoreResult = await noThrow(api.call("RESTORE_USER_AUTH_PROVIDER_OPTIONS_EX", testUser, "pushtotp", encryptedValue, aesKeyName, null));
        assertProcedureCallOk("RESTORE_USER_AUTH_PROVIDER_OPTIONS_EX", restoreResult);
        expect(restoreResult.length).toBeGreaterThan(0);
        expect(restoreResult[0].status).toBe("OK");

        // Step 7: Verify restored MFA provider
        let userAfterRestore = await noThrow(User.get(api, testUser));
        expect(userAfterRestore).toBeDefined();

        // Step 7.5: Generate TOTP code and login with it to verify the secret still works
        {
            let totpCode = generateTOTP(knownTotpSecret);
            let apiAsTestUserWithTOTP: MamoriService = new MamoriService(host, INSECURE);
            let loginWithTotpResult = await noThrow(apiAsTestUserWithTOTP.login(testUser, granteepw, totpCode));
            expect(loginWithTotpResult.username).toBe(testUser);
            await ignoreError(apiAsTestUserWithTOTP.logout());
        }

        // Step 8: Cleanup
        let cleanupResult = await noThrow(k.delete(api));
        expect(cleanupResult).toSucceed();
        await helper.EncryptionKey.cleanupAESEncryptionKey(api, aesKeyName);
        
    });

    /**
     * Extends the PushTOTP user setup from mamori user 04:
     * create → SQL SET VALIDATED → AUTHENTICATED BY pushtotp with known secret,
     * then portal password-only login (no otp on the wire), assert connection log +
     * pending MFA session, submit TOTP via set_ssid_notification, expect login OK.
     */
    test('mamori user 04b - pushtotp portal login pending MFA then token', async () => {
        // Unique per run: same username reuses cached PushTOTP success and skips a fresh pending MFA.
        const testUser = (grantee + "_ptotp_" + hhmmss()).toLowerCase();
        const knownTotpSecret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
        const k = new User(testUser)
            .withEmail(testUser + "@ace.com")
            .withFullName("PushTOTP Portal Login User");
        await ignoreError(k.delete(api));

        const createResult = await noThrow(k.create(api, granteepw));
        expect(createResult).toSucceed();

        // First-time portal login requires the account to be validated (SQL).
        const activateResult = await noThrow(
            api.select("ALTER USER " + testUser + " SET VALIDATED = TRUE"),
        );
        expect(activateResult).toSucceed();

        const setMfaResult = await noThrow(
            api.select(
                "ALTER USER " +
                    testUser +
                    " AUTHENTICATED BY pushtotp OPTIONS(SECRET '" +
                    knownTotpSecret +
                    "')",
            ),
        );
        expect(setMfaResult).toSucceed();
        await ignoreError(User.clearMFARequests(api, testUser));

        const subjectApi = new MamoriService(host, INSECURE);
        // Password-only portal login — Hub holds until PushTOTP is acknowledged.
        const loginPromise = subjectApi.login(
            testUser,
            granteepw,
            undefined,
            PORTAL_LOGIN_APPLICATION,
        );

        const loginStartedAt = Date.now();
        let pendingSession: any = null;
        let connectionRow: any = null;
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
            const conns = await listConnectionLogForUser(api, testUser, 30);
            // Must be an open portal-login row started for this attempt (not a stale closed row).
            connectionRow = conns.find((row) => {
                const end = col(row, "endtime");
                const open = end == null || String(end).trim() === "";
                const access = String(
                    col(row, "resource_access_type") || "",
                ).toLowerCase();
                const app = String(
                    col(row, "client_application") || col(row, "application") || "",
                ).toLowerCase();
                const portal =
                    access === "web_portal_login" ||
                    app.indexOf("portal login") >= 0 ||
                    app.indexOf("mamori portal") >= 0;
                return open && portal;
            });

            const pendingRes = await noThrow(
                api.select(
                    "SELECT * FROM SYS.USER_SESSIONS WHERE state = 'PENDING' AND lower(user_id) = lower('" +
                        testUser.replace(/'/g, "''") +
                        "')",
                ),
            );
            const pendingRows = rowsOf(pendingRes);
            if (connectionRow && pendingRows.length > 0) {
                pendingSession = pendingRows[0];
                break;
            }
            await helper.sleep(500);
        }

        expect(connectionRow).toBeTruthy();
        expect(col(connectionRow, "id") || col(connectionRow, "connection_id")).toBeTruthy();
        expect(String(col(connectionRow, "login_username") || "").toLowerCase()).toBe(
            testUser.toLowerCase(),
        );
        expect(pendingSession).toBeTruthy();
        const providerName = String(
            col(pendingSession, "provider_name") || "",
        ).toLowerCase();
        // Provider name may be instance name; type column is pushtotp.
        const providerType = String(
            col(pendingSession, "provider_type") || "",
        ).toLowerCase();
        expect(
            providerName.indexOf("pushtotp") >= 0 || providerType === "pushtotp",
        ).toBe(true);
        const ssid = col(pendingSession, "ssid");
        expect(ssid).toBeTruthy();
        // Guard against a false pass if Hub never saw the login (same symptom as om01).
        expect(Date.now() - loginStartedAt).toBeLessThan(60000);

        const totpCode = generateTOTP(knownTotpSecret);
        const notifyResult = await noThrow(
            api.select(
                "CALL set_ssid_notification('" +
                    String(ssid).replace(/'/g, "''") +
                    "', '" +
                    totpCode.replace(/'/g, "''") +
                    "')",
            ),
        );
        // CALL returns a result set array (e.g. [{status:"ok"}]) on success.
        expect(notifyResult).toSucceed();

        const loginResult = await noThrow(loginPromise);
        expect(loginResult.errors).toBeFalsy();
        expect(loginResult.username).toBe(testUser);

        await ignoreError(subjectApi.logout());
        const cleanupResult = await noThrow(k.delete(api));
        expect(cleanupResult).toSucceed();
    }, 120000);

    test('mamori user 05 - password hash export restore', async () => {
        let testUser = grantee + "_pwd_ex_test";
        // Strong passwords (upper, lower, numeric, punctuation) for password_character_type_minimum = 4
        const origPw = "OriginalTestPw9x!";
        const newPw = "ChangedTestPw9x!";

        let k = await createActiveValidatedUser(
            api,
            testUser,
            origPw,
            testUser + "@ace.com",
            "Password EX Test User",
        );

        //create aes key
        let aesKeyName = addUniqueExtension("test_user_05_pwd_aes_key_" + testbatch);
        await helper.EncryptionKey.setupAESEncryptionKey(api, aesKeyName);
        //export password
        let exportResult = await noThrow(k.exportPassword(api, aesKeyName));
        assertProcedureCallOk("EXPORT_USER_PASSWORD_EX", exportResult);
        expect(exportResult.length).toBeGreaterThan(0);
        let encryptedValue = exportResult[0].value;
        expect(encryptedValue).toBeDefined();
        //
        let alterPw = await noThrow(api.select("ALTER USER " + testUser + " IDENTIFIED BY '" + newPw + "'"));
        expect(alterPw).toSucceed();

        {
            let apiNewPw = new MamoriService(host, INSECURE);
            let loginNew = await noThrow(apiNewPw.login(testUser, newPw));
            expect(loginNew.username).toBe(testUser);
            await ignoreError(apiNewPw.logout());
        }
        {
            let badOld = await noThrow(new MamoriService(host, INSECURE).login(testUser, origPw));
            expect(badOld.errors).toBe(true);
        }

        let restoreResult = await noThrow(k.restorePassword(api, encryptedValue, aesKeyName));
        assertProcedureCallOk("RESTORE_USER_PASSWORD_EX", restoreResult);
        expect(restoreResult[0].status).toBe("OK");

        {
            let apiRestored = new MamoriService(host, INSECURE);
            let loginOrig = await noThrow(apiRestored.login(testUser, origPw));
            expect(loginOrig.username).toBe(testUser);
            await ignoreError(apiRestored.logout());
        }
        {
            let badNew = await noThrow(new MamoriService(host, INSECURE).login(testUser, newPw));
            expect(badNew.errors).toBe(true);
        }

        //**********************
        //   cleanup
        //**********************
        //delete user
        let cleanupResult = await noThrow(k.delete(api));
        expect(cleanupResult).toSucceed();
        //cleanup aes key
        await helper.EncryptionKey.cleanupAESEncryptionKey(api, aesKeyName);


    });

   test('mamori user 06 - password EX restore rejects wrong username', async () => {
        let testUser = grantee + "_pwd_ex_mismatch";
        const origPw = "MismatchTestPw9x!";
        let k = await createActiveValidatedUser(
            api,
            testUser,
            origPw,
            testUser + "@ace.com",
            "Pwd EX mismatch test",
        );

        let aesKeyName = addUniqueExtension("test_user_06_pwd_aes_key_" + testbatch);
        await helper.EncryptionKey.setupAESEncryptionKey(api, aesKeyName);

        let exportResult = await noThrow(k.exportPassword(api, aesKeyName));
        assertProcedureCallOk("EXPORT_USER_PASSWORD_EX", exportResult);
        let encryptedValue = exportResult[0].value;

        let badRestore = await noThrow(
            k.restorePassword(api, encryptedValue, aesKeyName, testUser + "_wrong_user"),
        );
        expect(badRestore.errors).toBe(true);

        let cleanupResult = await noThrow(k.delete(api));
        expect(cleanupResult).toSucceed();
        await helper.EncryptionKey.cleanupAESEncryptionKey(api, aesKeyName);
    });

    // Requires MAMORI_SERVER2, MAMORI_USERNAME2, MAMORI_PASSWORD2; skipped otherwise.
    dualServerTest('mamori user 07 - cross-server password EX restore', async () => {
        const api2 = new MamoriService(host2, INSECURE);
        await api2.login(username2, password2);

        const testUser = grantee + "_xsite_pwd";
        // Strong distinct passwords (upper, lower, numeric, punctuation) for both servers' policies
        const sourcePw = "XsiteSourceTestPw9x!A";
        const targetPw = "XsiteTargetTestPw9x!B";
        const aesKeyName = addUniqueExtension(grantee + "_xsite_pwd_aes_" + testbatch);
        const xsiteEmail = testUser + "@ace.com";
        const xsiteFullName = "Cross-site PWD Test User";

        try {
            await helper.EncryptionKey.setupAESEncryptionKey(api, aesKeyName);
            await helper.EncryptionKey.setupAESEncryptionKey(api2, aesKeyName);

            let k = await createActiveValidatedUser(
                api,
                testUser,
                sourcePw,
                xsiteEmail,
                xsiteFullName,
            );
            await createActiveValidatedUser(
                api2,
                testUser,
                targetPw,
                xsiteEmail,
                xsiteFullName,
            );

            let exportResult = await noThrow(k.exportPassword(api, aesKeyName));
            assertProcedureCallOk("EXPORT_USER_PASSWORD_EX", exportResult);
            expect(exportResult.length).toBeGreaterThan(0);
            let encryptedValue = exportResult[0].value;
            expect(encryptedValue).toBeDefined();

            let restoreResult = await noThrow(k.restorePassword(api2, encryptedValue, aesKeyName));
            assertProcedureCallOk("RESTORE_USER_PASSWORD_EX", restoreResult);
            expect(restoreResult[0].status).toBe("OK");

            {
                let apiRestored = new MamoriService(host2, INSECURE);
                let loginWithSourcePw = await noThrow(apiRestored.login(testUser, sourcePw));
                expect(loginWithSourcePw.errors).toBeFalsy();
                expect(loginWithSourcePw.username).toBe(testUser);
                await ignoreError(apiRestored.logout());
            }
            {
                let badTargetPw = await noThrow(new MamoriService(host2, INSECURE).login(testUser, targetPw));
                expect(badTargetPw.errors).toBe(true);
            }

            let delSource = await noThrow(k.delete(api));
            expect(delSource).toSucceed();
            let delTarget = await noThrow(k.delete(api2));
            expect(delTarget).toSucceed();
            await helper.EncryptionKey.cleanupAESEncryptionKey(api, aesKeyName);
            await helper.EncryptionKey.cleanupAESEncryptionKey(api2, aesKeyName);
        } finally {
            await ignoreError(api2.logout());
        }
    });

    test('mamori user tags - add/remove (soft-delete does not cascade)', async () => {
        const userName = ('test_user_tags_' + testbatch).toLowerCase();
        const tagName = 'test_user_tag_' + testbatch;
        const user = new User(userName).withEmail(userName + '@ace.com').withFullName('Tag Test User');
        await ignoreError(user.delete(api));
        const existingTag = await ignoreError(Tag.getByName(api, tagName));
        if (existingTag && existingTag.id) {
            await ignoreError(existingTag.delete(api));
        }

        expect(await noThrow(user.create(api, granteepw))).toSucceed();

        const tag = new Tag(tagName);
        expect(await noThrow(tag.create(api))).toSucceed();
        expect(tag.id).toBeTruthy();

        try {
            expect(await noThrow(user.addTag(api, tag))).toSucceed();

            let assignments = await noThrow(Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            let match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'user' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === userName.toLowerCase(),
            );
            expect(match.length).toBe(1);

            expect(await noThrow(user.removeTag(api, tag))).toSucceed();
            assignments = await noThrow(Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'user' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === userName.toLowerCase(),
            );
            expect(match.length).toBe(0);

            expect(await noThrow(user.addTag(api, tagName))).toSucceed();
            // Soft-delete does not cascade user_tags; clear before delete so assignments stay empty.
            expect(await noThrow(user.removeTag(api, tag))).toSucceed();
            expect(await noThrow(user.delete(api))).toSucceed();

            assignments = await noThrow(Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'user' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === userName.toLowerCase(),
            );
            expect(match.length).toBe(0);
        } finally {
            await ignoreError(user.delete(api));
            await ignoreError(tag.delete(api));
        }
    });

});

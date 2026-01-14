import { MamoriService } from '../../api';
import * as https from 'https';
import { User, MFA_PROVIDER } from '../../user';
import { DatasourcePermission, DB_PERMISSION, TIME_UNIT } from '../../permission';
import { handleAPIException, noThrow, ignoreError } from '../../utils';
import * as helper from '../../__utility__/test-helper';
import '../../__utility__/jest/error_matcher';
import * as crypto from 'crypto';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

/**
 * Generate a TOTP code from a base32-encoded secret
 * @param secret Base32-encoded secret string
 * @returns 6-digit TOTP code as string
 */
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

    test('mamori user 03 - MFA export restore', async () => {
        // Step 1: Create a new user
        let testUser = grantee + "_mfa_test";
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
        let aesKeyName = "test_user_03_aes_key_" + testbatch;
        await helper.EncryptionKey.setupAESEncryptionKey(api, aesKeyName);

        // Step 3.5: Activate the user before exporting options
        let exportResult = await noThrow(api.call("EXPORT_USER_AUTH_PROVIDER_OPTIONS_EX", testUser, "pushtotp", aesKeyName));
        // noThrow returns error object on failure, actual data on success
        if (exportResult.error !== undefined && exportResult.error !== false) {
            fail("Export failed: " + JSON.stringify(exportResult));
        }
        expect(Array.isArray(exportResult)).toBe(true);
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
        
        // noThrow returns error object on failure, actual data on success
        if (restoreResult.error !== undefined && restoreResult.error !== false) {
            fail("Restore failed: " + JSON.stringify(restoreResult));
        }
        expect(Array.isArray(restoreResult)).toBe(true);
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



});

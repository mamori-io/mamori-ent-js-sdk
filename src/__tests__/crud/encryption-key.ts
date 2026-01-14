import { MamoriService } from '../../api';
import * as https from 'https';
import { Key, KEY_TYPE, SSH_ALGORITHM } from '../../key';
import { handleAPIException, noThrow, ignoreError } from '../../utils';
import * as helper from '../../__utility__/test-helper';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("encryption key tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_key" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!98712_vdQ'}D"

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);


        await ignoreError(api.delete_user(grantee));
        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        })

        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);

    });

    afterAll(async () => {
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });


    test('aes 01', async () => {
        let k = new Key("test_aes_key" + testbatch);

        await ignoreError(k.delete(api));

        //Create
        k.ofType(KEY_TYPE.AES);
        let res = await noThrow(k.create(api));
        expect(res).toSucceed();

        //Ensure key returned properly
        let x = (await noThrow(Key.getAll(api))).filter((key: any) => key.name == k.name)[0];
        expect(x.type).toBe(KEY_TYPE.AES);
        expect(x.private_key).toBeUndefined();

        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x2.length).toBe(0);

        //Grant Key to User
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3).toBe('Granted');
        //Ensure user can see the key
        let x4 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDel2 = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);


        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);


        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();
    });

    test('rsa pair as admin', async () => {
        let name = "test_rsa_key" + testbatch;
        let k = new Key(name);

        let kpub = new Key(name + "_public");
        let kpriv = new Key(name + "_private");
        await ignoreError(kpub.delete(api));
        await ignoreError(kpriv.delete(api));


        //Create
        k.ofType(KEY_TYPE.RSA);
        let res = await noThrow(k.create(api));
        expect(res).toContain("-----BEGIN PUBLIC KEY----");

        //Ensure key returned properly
        let x = (await noThrow(Key.getAll(api))).filter((key: any) => key.name.includes(k.name) && key.usage === 'PUBLIC')[0];
        expect(x.type).toBe(KEY_TYPE.RSA);
        expect(x.public_key).toContain("-----BEGIN PUBLIC KEY-----");
        expect(x.private_key).toBeUndefined();

        //Ensure key returned properly
        let xpriv = (await noThrow(Key.getAll(api))).filter((key: any) => key.name.includes(k.name) && key.usage === 'PRIVATE')[0];
        expect(xpriv.type).toBe(KEY_TYPE.RSA);
        expect(xpriv.public_key).toContain("-----BEGIN PUBLIC KEY-----");
        expect(xpriv.private_key).toBeUndefined()


        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name.includes(k.name));
        expect(x2.length).toBe(0);

        //Grant Key to User
        let x3 = await noThrow(kpub.grantTo(api, grantee));
        expect(x3).toBe('Granted');
        //Ensure user can see the key
        let x4 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name.includes(k.name));
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDelU = await ignoreError(kpub.delete(apiAsAPIUser));
        expect(resDelU.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await noThrow(kpub.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name.includes(k.name));
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(kpub.delete(api));
        expect(resDel).toSucceed();
        let resDel2 = await noThrow(kpriv.delete(api));
        expect(resDel2).toSucceed();
    });

    test('ssh rsa 01', async () => {
        let publicKeyTest = "ssh-rsa"
        let name = "test_ssh_key" + testbatch;
        let k = new Key(name);
        await ignoreError(k.delete(api));
        //Create
        k.ofType(KEY_TYPE.SSH).withAlgorithm(SSH_ALGORITHM.RSA).ofSize(1024);
        let res = await ignoreError(k.create(api));
        expect(res).toContain(publicKeyTest);

        //Ensure key returned properly
        let x = (await noThrow(Key.getAll(api))).filter((key: any) => key.name === k.name && key.usage === 'PRIVATE')[0];
        expect(x.type).toBe(KEY_TYPE.SSH);
        expect(x.public_key).toContain(publicKeyTest);
        expect(x.private_key).toBeUndefined();

        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x2.length).toBe(0);

        //Grant Key to User
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3).toBe('Granted');
        //Ensure user can see the key
        let x4 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDelU = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDelU.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();

    });

    test('ssh dsa 01', async () => {
        let publicKeyTest = "ssh-dss"
        let name = "test_ssh_key" + testbatch;
        let k = new Key(name);
        await ignoreError(k.delete(api));
        //Create
        k.ofType(KEY_TYPE.SSH).withAlgorithm(SSH_ALGORITHM.DSA).ofSize(1024);
        let res = await noThrow(k.create(api));
        expect(res).toContain(publicKeyTest);

        //Ensure key returned properly
        let x = (await noThrow(Key.getAll(api))).filter((key: any) => key.name === k.name && key.usage === 'PRIVATE')[0];
        expect(x.type).toBe(KEY_TYPE.SSH);
        expect(x.public_key).toContain(publicKeyTest);
        expect(x.private_key).toBeUndefined();


        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x2.length).toBe(0);

        //Grant Key to User
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3).toBe('Granted');
        //Ensure user can see the key
        let x4 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDelU = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDelU.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();
    });

    test('ssh ecdsa 01', async () => {
        let publicKeyTest = "ecdsa-sha2-nistp384"
        let name = "test_ssh_key" + testbatch;
        let k = new Key(name);
        await ignoreError(k.delete(api));
        //Create
        //256
        //384
        //521
        k.ofType(KEY_TYPE.SSH).withAlgorithm(SSH_ALGORITHM.ECDSA).ofSize(384);
        let res = await noThrow(k.create(api));
        expect(res).toContain(publicKeyTest);

        //Ensure key returned properly
        let x = (await noThrow(Key.getAll(api))).filter((key: any) => key.name === k.name && key.usage === 'PRIVATE')[0];
        expect(x.type).toBe(KEY_TYPE.SSH);
        expect(x.public_key).toContain(publicKeyTest);
        expect(x.private_key).toBeUndefined();


        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x2.length).toBe(0);

        //Grant Key to User
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3).toBe('Granted');
        //Ensure user can see the key
        let x4 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDelU = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDelU.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();
    });

    test('ssh ed25519 01', async () => {
        let publicKeyTest = "ssh-ed25519"
        let name = "test_ssh_key" + testbatch;
        let k = new Key(name);
        await ignoreError(k.delete(api));
        //Create
        k.ofType(KEY_TYPE.SSH).withAlgorithm(SSH_ALGORITHM.ED25519);
        let res = await noThrow(k.create(api));
        expect(res).toContain(publicKeyTest);

        //Ensure key returned properly
        let x = (await noThrow(Key.getAll(api))).filter((key: any) => key.name === k.name && key.usage === 'PRIVATE')[0];
        expect(x.type).toBe(KEY_TYPE.SSH);
        expect(x.public_key).toContain(publicKeyTest);
        expect(x.private_key).toBeUndefined();


        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x2.length).toBe(0);

        //Grant Key to User
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3).toBe('Granted');
        //Ensure user can see the key
        let x4 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDelU = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDelU.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();
    });

    test('ssh key export restore 01', async () => {
        // Step 1: Setup - Create AES Encryption Key
        let aesKeyName = "test_ssh_export_aes_" + testbatch;
        await helper.EncryptionKey.setupAESEncryptionKey(api, aesKeyName);

        // Step 2: Create SSH Key
        let sshKeyName = "test_001_" + testbatch;
        let k = new Key(sshKeyName);
        await ignoreError(k.delete(api));
        k.ofType(KEY_TYPE.SSH).withAlgorithm(SSH_ALGORITHM.RSA).ofSize(1024);
        let res = await noThrow(k.create(api));
        expect(res).toContain("ssh-rsa");        

        // Step 3: Get Public Key for Verification
        let allKeys = await noThrow(Key.getAll(api));
        let originalKey = allKeys.filter((key: any) => key.name === k.name && key.usage === 'PRIVATE')[0];
        expect(originalKey).toBeDefined();
        expect(originalKey.type).toBe(KEY_TYPE.SSH);
        expect(originalKey.public_key).toBeDefined();
        expect(originalKey.public_key).toContain("ssh-rsa");
        let originalPublicKey = originalKey.public_key;

        // Step 4: Export SSH Key
        let exportResult = await noThrow(api.call("EXPORT_KEY_EX", sshKeyName, aesKeyName));
        // noThrow returns error object on failure, actual data on success
        if (exportResult.error !== undefined && exportResult.error !== false) {
            fail("Export failed: " + JSON.stringify(exportResult));
        }
        expect(Array.isArray(exportResult)).toBe(true);
        expect(exportResult.length).toBeGreaterThan(0);
        let exportedData = exportResult[0];
        expect(exportedData.value).toBeDefined();
        expect(exportedData.algorithm).toBe("SSH");
        expect(exportedData.usage).toBeDefined();
        let encryptedValue = exportedData.value;
        let exportedAlgorithm = exportedData.algorithm;
        let exportedUsage = exportedData.usage;

        // Step 5: Delete SSH Key
        let deleteResult = await noThrow(k.delete(api));
        expect(deleteResult).toSucceed();

        // Verify key is deleted
        let keysAfterDelete = await noThrow(Key.getAll(api));
        let deletedKey = keysAfterDelete.filter((key: any) => key.name === k.name);
        expect(deletedKey.length).toBe(0);

        // Step 6: Restore SSH Key
        let restoreResult = await noThrow(api.call("RESTORE_KEY_EX", sshKeyName, encryptedValue, exportedAlgorithm, exportedUsage, aesKeyName));
        // noThrow returns error object on failure, actual data on success
        if (restoreResult.error !== undefined && restoreResult.error !== false) {
            fail("Restore failed: " + JSON.stringify(restoreResult));
        }
        expect(Array.isArray(restoreResult)).toBe(true);
        expect(restoreResult.length).toBeGreaterThan(0);
        expect(restoreResult[0].status).toBe("OK");

        // Step 7: Verify Restored Key
        let keysAfterRestore = await noThrow(Key.getAll(api));
        let restoredKey = keysAfterRestore.filter((key: any) => key.name === k.name)[0];
        expect(restoredKey).toBeDefined();
        expect(restoredKey.type).toBe(KEY_TYPE.SSH);
        expect(restoredKey.public_key).toBeDefined();
        expect(restoredKey.public_key).toContain("ssh-rsa");
        expect(restoredKey.public_key).toBe(originalPublicKey);

        // Step 8: Cleanup
        let cleanupResult = await noThrow(k.delete(api));
        expect(cleanupResult).toSucceed();
        await helper.EncryptionKey.cleanupAESEncryptionKey(api, aesKeyName);
    });


});

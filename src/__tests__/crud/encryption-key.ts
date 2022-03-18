import { MamoriService } from '../../api';
import * as https from 'https';
import { Key, KEY_TYPE, SSH_ALGORITHM } from '../../key';
import { handleAPIException, noThrow, ignoreError } from '../../utils';

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
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

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


    test('aes 01', async done => {
        let k = new Key("test_aes_key" + testbatch);

        await ignoreError(k.delete(api));

        //Create
        k.ofType(KEY_TYPE.AES);
        let res = await noThrow(k.create(api));
        expect(res.error).toBe(false);

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
        expect(resDel2.response.status).toBe(400);


        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);


        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.error).toBe(false);

        done();
    });

    test('rsa pair as admin', async done => {
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
        expect(resDelU.response.status).toBe(400);

        let x5 = await noThrow(kpub.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name.includes(k.name));
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(kpub.delete(api));
        expect(resDel.error).toBe(false);
        let resDel2 = await noThrow(kpriv.delete(api));
        expect(resDel2.error).toBe(false);

        done();
    });

    test('ssh rsa 01', async done => {
        let publicKeyTest = "ssh-rsa"
        let name = "test_ssh_key" + testbatch;
        let k = new Key(name);
        await ignoreError(k.delete(api));
        //Create
        k.ofType(KEY_TYPE.SSH).withAlgorithm(SSH_ALGORITHM.RSA).ofSize(1024);
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
        expect(resDelU.response.status).toBe(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.error).toBe(false);

        done();
    });

    test('ssh dsa 01', async done => {
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
        expect(resDelU.response.status).toBe(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.error).toBe(false);

        done();
    });

    test('ssh ecdsa 01', async done => {
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
        expect(resDelU.response.status).toBe(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.error).toBe(false);

        done();
    });

    test('ssh ed25519 01', async done => {
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
        expect(resDelU.response.status).toBe(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name === k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.error).toBe(false);

        done();
    });


    test('aes 01', async done => {
        let k = new Key("test_aes_key" + testbatch);
        await ignoreError(k.delete(api));

        //Create
        k.ofType(KEY_TYPE.AES);
        let res = await noThrow(k.create(api));
        expect(res.error).toBe(false);

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
        expect(resDel2.response.status).toBe(400);


        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toBe('Revoked');
        //Ensure the key was revoked
        let x6 = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);


        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.error).toBe(false);

        done();
    });

    test.skip('rsa pair as non-admin', async done => {
        let name = "test_rsa_key2" + testbatch;
        let k = new Key(name);

        let kpub = new Key(name + "_public");
        let kpriv = new Key(name + "_private");
        await ignoreError(kpub.delete(apiAsAPIUser));
        await ignoreError(kpriv.delete(apiAsAPIUser));

        //Create
        k.ofType(KEY_TYPE.RSA);
        let res = await noThrow(k.create(apiAsAPIUser));
        expect(res).toContain("-----BEGIN PUBLIC KEY----");

        //Ensure key returned properly
        let x = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name.includes(k.name) && key.usage === 'PUBLIC')[0];
        console.log("***** %o", x);
        expect(x.type).toBe(KEY_TYPE.RSA);
        expect(x.public_key).toContain("-----BEGIN PUBLIC KEY-----");
        expect(x.private_key).toBeUndefined();

        //Ensure key returned properly
        let xpriv = (await noThrow(Key.getAll(apiAsAPIUser))).filter((key: any) => key.name.includes(k.name) && key.usage === 'PRIVATE')[0];
        expect(xpriv.type).toBe(KEY_TYPE.RSA);
        expect(xpriv.public_key).toContain("-----BEGIN PUBLIC KEY-----");
        expect(xpriv.private_key).toBeUndefined()

        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Key.getAll(api))).filter((key: any) => key.name.includes(k.name));
        expect(x2.length).toBe(0);

        done();
    });


});

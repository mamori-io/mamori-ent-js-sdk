import { MamoriService } from '../../api';
import * as https from 'https';
import { KeyPermission, TIME_UNIT } from '../../permission';
import { Key, KEY_TYPE } from '../../key';
import { handleAPIException, ignoreError, noThrow } from '../../utils';
import { Role } from '../../role';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("key permission tests", () => {

    let api: MamoriService;
    let key = "test_aes_key" + testbatch;
    let grantee = "test_apiuser_permissions." + testbatch;
    let permType = "KEY USAGE";
    let granteepw = "J{J'vpKsnsNm3W6(6A,4_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //
        await ignoreError(new Key(key).delete(api));
        await new Key(key).ofType(KEY_TYPE.AES).create(api).catch(e => {
            fail(handleAPIException(e));
        });
        //
        await ignoreError(api.delete_user(grantee));
        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        });
    });

    afterAll(async () => {
        await new Key(key).delete(api);
        await api.delete_user(grantee);
        await api.logout();
    });

    test('revoke 01', async done => {
        let resp = await noThrow(new KeyPermission()
            .key(key)
            .grantee(grantee)
            .all(true)
            .revoke(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee],
        ["key_name", "equals", key]];
        let res = await new KeyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        done();

    });

    test('grant 01', async done => {

        let obj = new KeyPermission()
            .key(key)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee],
        ["key_name", "equals", key]];
        let res = await new KeyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new KeyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        done();
    });

    test('grant 02', async done => {

        let resp = await noThrow(new KeyPermission()
            .key(key)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee],
        ["key_name", "equals", key],
        ["time_left", ">", 3500]
        ];
        let res = await new KeyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new KeyPermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new KeyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        done();
    });

    test('grant 03', async done => {

        let dt = new Date();
        let year = dt.getFullYear();
        let month = (dt.getMonth() + 1).toString().padStart(2, '0');
        let day = dt.getDate().toString().padStart(2, '0');
        let today = year + "-" + month + "-" + day;
        let fromD = today + " 00:00";
        let toD = today + " 23:59:59";

        let obj = await new KeyPermission()
            .key(key)
            .grantee(grantee)
            .withValidBetween(fromD, toD);

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee],
        ["key_name", "equals", key],
        ["valid_from", "=", (new Date(fromD)).toISOString()],
        ["valid_until", "=", (new Date(toD)).toISOString()]
        ];
        let res = await new KeyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        let res2 = await new KeyPermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(0);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        done();
    });

    test('grant 04 - mixed case', async done => {
        let name = "CAPS" + key;
        let objMixedCase = new KeyPermission()
            .key(name)
            .grantee(grantee);
        let objLower = new KeyPermission()
            .key(name.toLowerCase())
            .grantee(grantee);

        await ignoreError(new Key(name).delete(api));
        await new Key(name).ofType(KEY_TYPE.AES).create(api).catch(e => {
            fail(handleAPIException(e));
        });

        //make sure no exist
        await ignoreError(objLower.revoke(api));
        await ignoreError(objMixedCase.revoke(api));

        //grant 1
        let r1 = await noThrow(objMixedCase.grant(api));
        expect(r1.errors).toBe(false);
        //Grant 2
        let r2 = await noThrow(objLower.grant(api));
        expect(r2.errors).toBe(true);
        //Revoke 1
        let r3 = await noThrow(objMixedCase.revoke(api));
        expect(r3.errors).toBe(false);
        //
        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee]];
        let r5 = await noThrow(new KeyPermission().grantee(grantee).list(api, filter));
        expect(r5.totalCount).toBe(0);
        //
        done();
    });

    test('test 05 role grant', async done => {
        let roleName = "test_permission_key_." + testbatch;
        let role = new Role(roleName);
        await ignoreError(role.delete(api));
        let x = await noThrow(role.create(api));
        expect(x.error).toBe(false);
        //
        // GRANT
        //
        let obj = new KeyPermission()
            .key(key)
            .grantee(roleName);
        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", roleName],
        ["key_name", "equals", key]];
        let res = await new KeyPermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new KeyPermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);



        //Delete role
        let d = await noThrow(role.delete(api));
        expect(d.error).toBe(false);

        done();
    });

});

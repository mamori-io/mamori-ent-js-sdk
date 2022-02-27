import { MamoriService } from '../../api';
import * as https from 'https';
import { KeyPermission, TIME_UNIT } from '../../permission';
import { Key, KEY_TYPE } from '../../key';
import { handleAPIException, ignoreError, noThrow } from '../../utils';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("key permission tests", () => {

    let api: MamoriService;
    let key = "test_aes_key" + testbatch;
    let grantee = "test_apiuser_permissions" + testbatch;
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

    test.skip('grant 03', async done => {

        let obj = await new KeyPermission()
            .key(key)
            .grantee(grantee)
            .withValidBetween("2022-01-01 00:00", "2022-01-15 00:00");

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee],
        ["key_name", "equals", key],
        ["valid_until", "=", '2022-01-14 13:00:00'],
        ["valid_from", "=", '2021-12-31 13:00:00'],
        ];
        let res = await new KeyPermission().grantee(grantee).list(api, filter);
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

});

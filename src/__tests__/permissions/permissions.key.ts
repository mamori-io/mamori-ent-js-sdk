import { MamoriService } from '../../../dist/api';
import * as https from 'https';
import { KeyPermission, TIME_UNIT } from '../../../dist/permission';
import { Key } from '../../../dist/key';


const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("key permission tests", () => {

    let api: MamoriService;
    let key = "test_aes_key";
    let grantee = "test_apiuser_key";
    let permType = "KEY USAGE";
    let granteepw = "J{J'vpKsnsNm3W6(6A,4_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //
        await new Key(key).ofType("AES").create(api);
        //
        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            console.log(e.response.data);
        });
    });

    afterAll(async () => {
        await new Key(key).delete(api);
        await api.delete_user(grantee);
        await api.logout();
    });

    test('revoke 01', async done => {
        try {
            let resp = await new KeyPermission()
                .key(key)
                .grantee(grantee)
                .all(true)
                .revoke(api);
            expect(resp.errors).toBe(false);

            let filter = [["permissiontype", "equals", permType],
            ["grantee", "equals", grantee],
            ["key_name", "equals", key]];
            let res = await new KeyPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(0);
            done();
        } catch (e) {
            done(e);
        }
    });

    test('grant 01', async done => {
        try {

            let obj = new KeyPermission()
                .key(key)
                .grantee(grantee);

            //make sure no exist
            await obj.revoke(api);

            let filter = [["permissiontype", "equals", permType],
            ["grantee", "equals", grantee],
            ["key_name", "equals", key]];
            let res = await new KeyPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(0);

            let resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            res = await new KeyPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(1);

            let resp2 = await obj.grant(api);
            expect(resp2.errors).toBe(true);

            resp = await obj.revoke(api);
            expect(resp.errors).toBe(false);

            resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            resp = await obj.revoke(api);
            expect(resp.errors).toBe(false);


            done();
        } catch (e) {
            done(e);
        }
    });

    test('grant 02', async done => {
        try {
            let resp = await new KeyPermission()
                .key(key)
                .grantee(grantee)
                .withValidFor(60, TIME_UNIT.MINUTES)
                .grant(api);
            expect(resp.errors).toBe(false);

            let filter = [["permissiontype", "equals", permType],
            ["grantee", "equals", grantee],
            ["key_name", "equals", key],
            ["time_left", ">", 3500]
            ];
            let res = await new KeyPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(1);
            let id = res.data[0].id;
            let r2 = await new KeyPermission().revokeByID(api, id);
            expect(r2.error).toBe(false);

            res = await new KeyPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(0);

            done();
        } catch (e) {
            done(e);
        }
    });

    test.skip('grant 03', async done => {
        try {
            let obj = await new KeyPermission()
                .key(key)
                .grantee(grantee)
                .withValidBetween("2022-01-01 00:00", "2022-01-15 00:00");

            await obj.revoke(api);

            let resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            let filter = [["permissiontype", "equals", permType],
            ["grantee", "equals", grantee],
            ["key_name", "equals", key],
            ["valid_until", "=", '2022-01-14 13:00:00'],
            ["valid_from", "=", '2021-12-31 13:00:00'],
            ];
            let res = await new KeyPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(1);

            let resp2 = await obj.grant(api);
            expect(resp2.errors).toBe(true);

            resp = await obj.revoke(api);
            expect(resp.errors).toBe(false);

            resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            resp = await obj.revoke(api);
            expect(resp.errors).toBe(false);
            done();
        } catch (e) {
            done(e);
        }
    });

});

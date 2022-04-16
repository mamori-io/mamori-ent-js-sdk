import { MamoriService } from '../../api';
import * as https from 'https';
import { MamoriPermission, MAMORI_PERMISSION, TIME_UNIT } from '../../permission';
import { handleAPIException, ignoreError, noThrow } from '../../utils';
import { Role } from '../../role';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("mamori permission tests", () => {

    let api: MamoriService;
    let grantee = "test_apiuser_mp" + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //create the user
        await ignoreError(api.delete_user(grantee));
        let result = await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        })
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await api.logout();
    });

    test('revoke 01', async done => {

        let resp = await noThrow(new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee)
            .all(true)
            .revoke(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", MAMORI_PERMISSION.VIEW_ALL_USER_LOGS],
        ["grantee", "equals", grantee]];
        let res = await new MamoriPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        done();
    });

    test('grant 01', async done => {
        let obj = new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", "equals", MAMORI_PERMISSION.VIEW_ALL_USER_LOGS],
        ["grantee", "equals", grantee]];
        let res = await new MamoriPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new MamoriPermission().grantee(grantee).list(api, filter);
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

        let resp = await noThrow(new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", MAMORI_PERMISSION.VIEW_ALL_USER_LOGS],
        ["grantee", "equals", grantee],
        ["time_left", ">", 3500]
        ];
        let res = await new MamoriPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new MamoriPermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new MamoriPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        done();
    });

    test.skip('grant 03', async done => {

        let fromDT = "2022-01-01 00:00";
        let toDT = "2023-01-01 00:00"
        let obj = await new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee)
            .withValidBetween(fromDT, toDT);

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", MAMORI_PERMISSION.VIEW_ALL_USER_LOGS],
        ["grantee", "equals", grantee],
        ["valid_from", "=", fromDT],
        ["valid_until", "=", toDT]
        ];
        let res = await new MamoriPermission().grantee(grantee).list(api, filter);
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

    test('test 05 role grant', async done => {
        let roleName = "test_permission_mamori_" + testbatch;
        let role = new Role(roleName);
        await ignoreError(role.delete(api));
        let x = await noThrow(role.create(api));
        expect(x.error).toBe(false);
        //
        // GRANT
        //
        let obj = new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(roleName);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", "equals", MAMORI_PERMISSION.VIEW_ALL_USER_LOGS],
        ["grantee", "equals", roleName]];
        let res = await new MamoriPermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new MamoriPermission().grantee(roleName).list(api, filter);
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

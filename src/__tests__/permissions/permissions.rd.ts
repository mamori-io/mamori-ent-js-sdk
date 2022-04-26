import { MamoriService } from '../../api';
import * as https from 'https';
import { RemoteDesktopLoginPermission, TIME_UNIT } from '../../permission';
import { handleAPIException, ignoreError, noThrow } from '../../utils';
import { Role } from '../../role';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("rdp permission tests", () => {

    let api: MamoriService;
    let rdpLogin = "test_fake_rdp_login" + testbatch;
    let grantee = "test_apiuser_rdp." + testbatch;
    let granteepw = "J{J'vMy72n\/a@C+W6(6A,4_vdQ'}D";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
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

        let resp = await new RemoteDesktopLoginPermission()
            .name(rdpLogin)
            .grantee(grantee)
            .all(true)
            .revoke(api);
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", "RDP"],
        ["grantee", "equals", grantee],
        ["key_name", "equals", rdpLogin]];
        let res = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        done();

    });

    test('grant 01', async done => {

        let obj = new RemoteDesktopLoginPermission()
            .name(rdpLogin)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", "equals", "RDP"],
        ["grantee", "equals", grantee],
        ["key_name", "equals", rdpLogin]];
        let res = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
        //console.log("**** %o", res);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        //let resp2q = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
        //console.log("****2 %o", resp2q);
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

        let resp = await noThrow(new RemoteDesktopLoginPermission()
            .name(rdpLogin)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", "RDP"],
        ["grantee", "equals", grantee],
        ["key_name", "equals", rdpLogin],
        ["time_left", ">", 3500]
        ];
        let res = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new RemoteDesktopLoginPermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
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

        let obj = await new RemoteDesktopLoginPermission()
            .name(rdpLogin)
            .grantee(grantee)
            .withValidBetween(fromD, toD);

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", "RDP"],
        ["grantee", "equals", grantee],
        ["key_name", "equals", rdpLogin],
        ["valid_from", "=", (new Date(fromD)).toISOString()],
        ["valid_until", "=", (new Date(toD)).toISOString()]
        ];
        let res = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        let res2 = await new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(0);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        done();

    });

    test('grant 04 - mixed case', async done => {
        let name = "CAPS" + rdpLogin;
        let objMixedCase = new RemoteDesktopLoginPermission()
            .name(name)
            .grantee(grantee);
        let objLower = new RemoteDesktopLoginPermission()
            .name(name.toLowerCase())
            .grantee(grantee);

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

        let filter = [["permissiontype", "equals", "RDP"],
        ["grantee", "equals", grantee]];
        let r5 = await noThrow(new RemoteDesktopLoginPermission().grantee(grantee).list(api, filter));
        expect(r5.totalCount).toBe(0);

        //
        done();
    });

    test('test 05 role grant', async done => {
        let roleName = "test_permission_rd_." + testbatch;
        let role = new Role(roleName);
        await ignoreError(role.delete(api));
        let x = await noThrow(role.create(api));
        expect(x.error).toBe(false);
        //
        // GRANT
        //
        let obj = new RemoteDesktopLoginPermission()
            .name(rdpLogin)
            .grantee(roleName);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", "equals", "RDP"],
        ["grantee", "equals", roleName],
        ["key_name", "equals", rdpLogin]];
        let res = await new RemoteDesktopLoginPermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new RemoteDesktopLoginPermission().grantee(roleName).list(api, filter);
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

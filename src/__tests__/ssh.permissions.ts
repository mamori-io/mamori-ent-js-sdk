import { MamoriService } from '../../dist/api';
import * as https from 'https';
import { SSHLoginPermission, TIME_UNIT } from '../../dist/permission';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("ssh permission tests", () => {

    let api: MamoriService;
    let sshLogin = "testssh";
    let grantee = "apiuser1";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

    test('revoke 01', async done => {
        try {
            let resp = await new SSHLoginPermission()
                .sshLogin(sshLogin)
                .grantee(grantee)
                .all(true)
                .revoke(api);
            expect(resp.errors).toBe(false);

            let filter = [["permissiontype", "equals", "SSH"],
            ["grantee", "equals", grantee],
            ["key_name", "equals", sshLogin]];
            let res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(0);
            done();
        } catch (e) {
            done(e);
        }
    });

    test.skip('grant 01', async done => {
        try {

            let obj = new SSHLoginPermission()
                .sshLogin(sshLogin)
                .grantee(grantee);

            //make sure no exist
            await obj.revoke(api);

            let filter = {
                "0": ["permissiontype", "equals", "SSH"],
                "1": ["grantee", "equals", grantee],
                "3": ["key_name", "equals", sshLogin]
            };
            let res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
            console.log("**** %o", res);
            expect(res.totalCount).toBe(0);

            let resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
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
            let resp = await new SSHLoginPermission()
                .sshLogin(sshLogin)
                .grantee(grantee)
                .withValidFor(60, TIME_UNIT.MINUTES)
                .grant(api);
            expect(resp.errors).toBe(false);

            let filter = [["permissiontype", "equals", "SSH"],
            ["grantee", "equals", grantee],
            ["key_name", "equals", sshLogin],
            ["time_left", ">", 3500]
            ];
            let res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(1);
            let id = res.data[0].id;
            let r2 = await new SSHLoginPermission().revokeByID(api, id);
            expect(r2.error).toBe(false);

            res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(0);

            done();
        } catch (e) {
            done(e);
        }
    });

    test('grant 03', async done => {
        try {
            let obj = await new SSHLoginPermission()
                .sshLogin(sshLogin)
                .grantee(grantee)
                .withValidBetween("2022-01-01 00:00", "2022-01-15 00:00");

            await obj.revoke(api);

            let resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            let filter = [["permissiontype", "equals", "SSH"],
            ["grantee", "equals", grantee],
            ["key_name", "equals", sshLogin],
            ["valid_until", "=", '2022-01-14 13:00:00'],
            ["valid_from", "=", '2021-12-31 13:00:00'],
            ];
            let res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
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

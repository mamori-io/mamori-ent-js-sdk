import { MamoriService } from '../../api';
import * as https from 'https';
import { handleAPIException, noThrow, ignoreError } from '../../utils';
import { MamoriPermission, MAMORI_PERMISSION, TIME_UNIT } from '../../permission';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });


describe("mamori catalog tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "t_user_catalog" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!@34#12_vdQ'}D" + testbatch;
    //jest.setTimeout(30000);

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

    test('catalog 01', async () => {
        //Select from the connection log
        let sql = "select * from SYS.CONNECTIONS where login_username !='" + grantee + "' limit 10";
        let r = await noThrow(apiAsAPIUser.select(sql));
        expect(r.length).toBe(0);
        //

        let perm = new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee);

        await noThrow(perm.grant(api));

        let r2 = await noThrow(apiAsAPIUser.select(sql));
        expect(r2.length).toBeGreaterThan(0);

        await noThrow(perm.revoke(api));
    });

    test('catalog 02', async () => {
        //Select from the connection log
        let sql = "select * from SYS.QUERIES where userid !='" + grantee + "' limit 10";
        let r = await noThrow(apiAsAPIUser.select(sql));

        expect(r.length).toBe(0);

        let perm = new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee);

        await noThrow(perm.grant(api));

        let r2 = await noThrow(apiAsAPIUser.select(sql));
        expect(r2.length).toBeGreaterThan(0);

        await noThrow(perm.revoke(api));
    });

    test('catalog 03', async () => {
        //Select from the connection log
        let sql = "select b.* from SYS.QUERIES a join SYS.QUERY_PLANS b on a.ssid = b.ssid and a.query_id = b.query_id and a.userid !='" + grantee + "' limit 10";
        let r = await noThrow(apiAsAPIUser.select(sql));
        expect(r.length).toBe(0);

        let perm = new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee);

        await noThrow(perm.grant(api));

        let r2 = await noThrow(apiAsAPIUser.select(sql));
        expect(r2.length).toBeGreaterThan(0);

        await noThrow(perm.revoke(api));
    });

    test('catalog 04', async () => {
        let sql = "select a.*  from sys.TCP_CONNECTION_LOG a join SYS.CONNECTIONS b on a.connection_id = b.id" +
            " and b.login_username !='" + grantee + "' limit 10";
        let r = await noThrow(apiAsAPIUser.select(sql));
        expect(r.length).toBe(0);

        let perm = new MamoriPermission()
            .permission(MAMORI_PERMISSION.VIEW_ALL_USER_LOGS)
            .grantee(grantee);

        await noThrow(perm.grant(api));
        //RUN AS ADMIN
        let r1 = await noThrow(api.select(sql));
        //RUN AS GRANTEE
        let r2 = await noThrow(apiAsAPIUser.select(sql));
        expect(r2.length).toBe(r1.length);
        await noThrow(perm.revoke(api));
    });
});

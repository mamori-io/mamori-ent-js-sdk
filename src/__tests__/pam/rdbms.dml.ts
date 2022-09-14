import { MamoriService } from '../../api';
import { io_https, io_permission, io_role, io_utils, io_serversession, io_user, io_sqlmaskingpolicies } from "../../api";


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("rdbms dml tests", () => {

    let api: MamoriService;

    let user: io_user.User;
    let grantee = "test_apiuser_dml" + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D";
    let accessRoleName = "test_masking_access_role_002_" + testbatch;

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);

        await api.login(username, password);
        //create the user
        user = new io_user.User(grantee).withEmail("test@.test.com");
        await io_utils.ignoreError(user.delete(api));
        await user.create(api, granteepw).catch(e => {
            fail(io_utils.handleAPIException(e));
        });
        //Grant roles with db permissions
        let p = await io_utils.noThrow(new io_permission.RolePermission().role("db_creds").grantee(grantee).grant(api));
        expect(p.errors).toBe(false);

        let r = await io_utils.noThrow(new io_role.Role(accessRoleName).create(api));
        let grant1 = await io_utils.noThrow(new io_permission.DatasourcePermission()
            .permission(io_permission.DB_PERMISSION.MASKED)
            .on('*', '', '', '')
            .grantee(accessRoleName)
            .grant(api));

        let grant2 = await io_utils.noThrow(new io_permission.DatasourcePermission()
            .permissions([io_permission.DB_PERMISSION.SELECT, io_permission.DB_PERMISSION.CALL, io_permission.DB_PERMISSION.EXECUTE_SQL_BLOCK])
            .on('*', '*', '*', '*')
            .grantee(accessRoleName)
            .grant(api));
        let p2 = await io_utils.noThrow(new io_permission.RolePermission().role(accessRoleName).grantee(grantee).grant(api));
        expect(p2.errors).toBe(false);
    });

    afterAll(async () => {
        await user.delete(api);
        await io_utils.noThrow(new io_role.Role(accessRoleName).delete(api));
        await api.logout();
    });

    test('masking oracle CH1711', async done => {
        let apiUser: MamoriService = new MamoriService(host, INSECURE);
        try {
            await apiUser.login(user.username, granteepw);
            //SET PASSTHROUGH for session
            let x = await io_utils.noThrow(io_serversession.ServerSession.setPassthrough(apiUser, "oracle193"));
            expect(x.errors).toBe(false);
            //ISSUE ORACLE QUERY AND CONFIRM DATA IS MASKED
            let x1 = await io_utils.noThrow(apiUser.simple_query("select * from DEMO.CUSTOMER_PII where rownum < 5"));
            expect(x1.length).toBeGreaterThan(0);
            expect(x1[0].FIRST_NAME).toContain("XXXX");
            //GRANT TO USER
            let permission = new io_permission.MamoriPermission().permission(io_permission.MAMORI_PERMISSION.ALL_PRIVILEGES).grantee(user.username);
            let x2 = await io_utils.noThrow(permission.grant(api));
            expect(x2.errors).toBe(false);
            let x3 = await apiUser.simple_query("select * from DEMO.CUSTOMER_PII where rownum < 5");
            expect(x3.length).toBeGreaterThan(0);
            expect(x3[0].FIRST_NAME).toContain("XXXX");
            let x4 = await io_utils.noThrow(permission.revoke(api));
            expect(x4.errors).toBe(false);
        } finally {
            await apiUser.logout();
        }
        done();
    });

});
import { MamoriService } from '../../api';
import { io_https, io_permission, io_role, io_utils, io_serversession, io_user, io_sqlmaskingpolicies } from "../../api";


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
const oracle_ds = process.env.MAMORI_ORACLE_DATASOURCE || '';
const credential_role = process.env.MAMORI_CREDENTIAL_ROLE || 'db_creds';

let oratest = oracle_ds ? test : test.skip;

describe("masking policy tests", () => {

    let api: MamoriService;

    let user: io_user.User;
    let grantee = "test_apiuser-session." + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"
    let accessRoleName = "test_masking_access_role_003_" + testbatch;

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);

        await api.login(username, password);
        //create the user
        user = new io_user.User(grantee).withEmail("test@.test.com");
        await io_utils.ignoreError(user.delete(api));
        await user.create(api, granteepw).catch(e => {
            fail(io_utils.handleAPIException(e));
        });

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
    });

    afterAll(async () => {
        await user.delete(api);
        await io_utils.noThrow(new io_role.Role(accessRoleName).delete(api));
        await api.logout();
    });

    oratest('set passthrough', async () => {
        let apiUser: MamoriService = new MamoriService(host, INSECURE);

        try {
            await apiUser.login(user.username, granteepw);

            //SET PASSTHROUGH Should fail since user does not have DB creds for DB
            let x = await io_utils.noThrow(io_serversession.ServerSession.setPassthrough(apiUser, oracle_ds));
            expect(x.errors).toBe(true);
            //Grant roles with db permissions
            let p = await io_utils.noThrow(new io_permission.RolePermission().role(credential_role).grantee(grantee).grant(api));
            expect(p.errors).toBe(false);
            let p2 = await io_utils.noThrow(new io_permission.RolePermission().role(accessRoleName).grantee(grantee).grant(api));
            expect(p2.errors).toBe(false);
            let x2 = await io_utils.noThrow(io_serversession.ServerSession.setPassthrough(apiUser, oracle_ds));
            expect(x2.errors).toBe(false);

        } finally {
            await apiUser.logout();
        }
    });

});

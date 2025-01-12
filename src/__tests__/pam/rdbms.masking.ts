import { MamoriService } from '../../api';
import { io_https, io_permission, io_role, io_utils, io_serversession, io_user, io_sqlmaskingpolicies } from "../../api";
import * as helper from '../../__utility__/test-helper';
import '../../__utility__/jest/error_matcher'

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const credential_role = process.env.MAMORI_CREDENTIAL_ROLE || 'db_creds';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
const oracle_ds = process.env.MAMORI_ORACLE_DATASOURCE || '';
const sqlserver_ds = process.env.MAMORI_SQLSERVER_DATASOURCE || '';

let oratest = oracle_ds ? test : test.skip;
let sstest = sqlserver_ds ? test : test.skip;

describe("masking policy tests", () => {

    let api: MamoriService;

    let user: io_user.User;
    let grantee = "test_apiuser_masking-policy" + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"
    let accessRoleName = "test_masking_access_role_001_" + testbatch;

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);

        await api.login(username, password);
        //create the user
        user = new io_user.User(grantee).withEmail("test@test.com");
        await io_utils.ignoreError(user.delete(api));
        await user.create(api, granteepw).catch(e => {
            fail(io_utils.handleAPIException(e));
        });
        //Grant roles with db permissions
        let p = await io_utils.noThrow(new io_permission.RolePermission().role(credential_role).grantee(grantee).grant(api));
        expect(p).toSucceed();

        //CREATE THE ROLE WITH DB ACCESS
        //MASKED PASSTHROUGH,SELECT, CALL, EXECUTE SQL BLOCK

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
        expect(p2).toSucceed()
    });

    afterAll(async () => {
        await user.delete(api);
        await io_utils.noThrow(new io_role.Role(accessRoleName).delete(api));
        await api.logout();
    });

    oratest('masking oracle CH1711', async () => {
        //admin passthrough session to db.

        let testID = "orach1711";
        let dsname = oracle_ds;
        let dbname = "orclpdb1";

        let adminApi = new MamoriService(host, INSECURE);
        await adminApi.login(username, password);
        try {
            let rows: any = await adminApi.select("select databasename from sys.datasources where systemname='" + dsname + "'");
            expect(rows).toSucceed();
            dbname = rows[0].databasename;
        } finally {
            adminApi.logout();
        }

        let schemaName = 'm' + testbatch;
        let rules = [{ objecturi: dsname + "." + dbname + "." + schemaName + ".tab1", column: "col1", mask: "masked by full()" }];
        let policyName = testID + '_policy_' + testbatch;

        //Create the object
        let apiAdminPassthrough = await helper.DBHelper.preparePassthroughSession(host, username, password, dsname);
        try {
            await io_utils.noThrow(helper.DBHelper.prepareOracleObjects(apiAdminPassthrough, schemaName));
            //console.log("DML %o", prep);
            //create the masking policy
            let mpolicy: io_sqlmaskingpolicies.SQLMaskingPolicy = await helper.DBHelper.addMaskingPolicy(api, policyName, rules);
            //grant the policy to the user
            await io_utils.noThrow(mpolicy.grantTo(api, user.username));
            let apiUser = await helper.DBHelper.preparePassthroughSession(host, user.username, granteepw, dsname);
            try {

                //ISSUE ORACLE QUERY AND CONFIRM DATA IS MASKED
                let x1 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x1).toSucceed();
                expect(x1.length).toBeGreaterThan(0);
                expect(x1[0].col1).toContain("XXXX");
                //GRANT TO USER
                let permission = new io_permission.MamoriPermission().permission(io_permission.MAMORI_PERMISSION.ALL_PRIVILEGES).grantee(user.username);
                let x2 = await io_utils.noThrow(permission.grant(api));
                expect(x2).toSucceed();
                let x3 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x3).toSucceed();
                expect(x3.length).toBeGreaterThan(0);
                expect(x3[0].col1).toContain("XXXX");
                let x4 = await io_utils.noThrow(permission.revoke(api));
                expect(x4).toSucceed();

            } finally {
                await apiUser.disconnect();
                await io_utils.noThrow(mpolicy.delete(api));
            }

        } finally {
            await io_utils.noThrow(helper.DBHelper.cleanUpSchemaOracle(apiAdminPassthrough, schemaName));
            apiAdminPassthrough.disconnect();
        }
    });

    oratest('masking oracle select with where clause', async () => {
        //admin passthrough session to db.

        let testID = "orach7309";
        let dsname = oracle_ds;
        let dbname = "orclpdb1";

        let adminApi = new MamoriService(host, INSECURE);
        await adminApi.login(username, password);
        try {
            let rows: any = await adminApi.select("select databasename from sys.datasources where systemname='" + dsname + "'");
            expect(rows).toSucceed();
            dbname = rows[0].databasename;
        } finally {
            adminApi.logout();
        }

        let schemaName = 'm' + testbatch;
        //let rules = [{ objecturi: dsname + "." + dbname + "." + schemaName + ".tab1", column: "col1", mask: "masked by full()" }];
        let policyName = testID + '_policy_' + testbatch;
        //Create the object
        let apiAdminPassthrough = await helper.DBHelper.preparePassthroughSession(host, username, password, dsname);
        try {

            let prep = await io_utils.noThrow(helper.DBHelper.prepareOracleObjects(apiAdminPassthrough, schemaName));
            //Create the permission with the where filter
            let perm = (new io_permission.DatasourcePermission()).on(dsname, dbname, schemaName, "tab1")
                .permission(io_permission.DB_PERMISSION.SELECT)
                .withClause("$.col1 = 'value6'")
                .grantee(user.username);
            let apiUser = await helper.DBHelper.preparePassthroughSession(host, user.username, granteepw, dsname);
            try {
                //GET ALL ROWS
                let x1 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x1).toSucceed();
                expect(x1.length).toBeGreaterThan(1);
                //GRANT RESTRICTION ON SELECT
                await io_utils.noThrow(perm.grant(api))
                let x2 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x1).toSucceed();
                expect(x2.length).toBe(1);
                //REVOKE
                await io_utils.noThrow(perm.revoke(api));
                //GET ALL DATA
                let x3 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x1).toSucceed();
                expect(x3.length).toBeGreaterThan(1);
            } finally {
                apiUser.disconnect();
            }

        } finally {
            await io_utils.noThrow(helper.DBHelper.cleanUpSchemaOracle(apiAdminPassthrough, schemaName));
            apiAdminPassthrough.disconnect();
        }
    });

    sstest('masking sqlserver select with where clause', async () => {
        //admin passthrough session to db.

        let testID = "ssch7309";
        let dsname = sqlserver_ds;
        let dbname = "mamori";
        let schemaName = testID + '_' + testbatch;
        //Create the object
        let apiAdminPassthrough = await helper.DBHelper.preparePassthroughSession(host, username, password, dsname);
        try {

            let prep = await io_utils.noThrow(helper.DBHelper.prepareSSObjects(apiAdminPassthrough, schemaName));
            //Create the permission with the where filter
            let perm = (new io_permission.DatasourcePermission()).on(dsname, dbname, schemaName, "tab1")
                .permission(io_permission.DB_PERMISSION.SELECT)
                .withClause("$.col1 = 'value6'")
                .grantee(user.username);
            let apiUser = await helper.DBHelper.preparePassthroughSession(host, user.username, granteepw, dsname);
            try {
                //GET ALL ROWS
                let x1 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x1.length).toBeGreaterThan(1);
                //GRANT RESTRICTION ON SELECT
                await io_utils.noThrow(perm.grant(api))
                let x2 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x2.length).toBe(1);
                //REVOKE
                await io_utils.noThrow(perm.revoke(api));
                //GET ALL DATA
                let x3 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x3.length).toBeGreaterThan(1);
            } finally {
                await apiUser.disconnect();
            }

        } finally {
            await io_utils.noThrow(helper.DBHelper.cleanUpSchemaSS(apiAdminPassthrough, schemaName));
            apiAdminPassthrough.disconnect();
        }
    });

    sstest('masking MSSQL CH1711', async () => {
        //admin passthrough session to db
        let testID = "ssch1711";
        let dsname = sqlserver_ds;
        let dbname = "mamori";
        let schemaName = testID + '_' + testbatch;
        let rules = [{ objecturi: dsname + "." + dbname + "." + schemaName + ".tab1", column: "col1", mask: "masked by full()" }];
        let policyName = testID + '_policy_' + testbatch;
        //Create the object
        let apiAdminPassthrough = await helper.DBHelper.preparePassthroughSession(host, username, password, dsname);
        try {
            let prep = await io_utils.noThrow(helper.DBHelper.prepareSSObjects(apiAdminPassthrough, schemaName));
            //create the masking policy
            let mpolicy: io_sqlmaskingpolicies.SQLMaskingPolicy = await io_utils.noThrow(helper.DBHelper.addMaskingPolicy(api, policyName, rules));
            //grant the policy to the user
            await io_utils.noThrow(mpolicy.grantTo(api, user.username));
            let apiUser = await helper.DBHelper.preparePassthroughSession(host, user.username, granteepw, dsname);
            try {
                //ISSUE  QUERY AND CONFIRM DATA IS MASKED
                let x1 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x1.length).toBeGreaterThan(0);
                expect(x1[0].col1).toContain("XXXX");
                //GRANT TO USER
                let permission = new io_permission.MamoriPermission().permission(io_permission.MAMORI_PERMISSION.ALL_PRIVILEGES).grantee(user.username);
                let x2 = await io_utils.noThrow(permission.grant(api));
                expect(x2.errors).toBe(false);
                let x3 = await io_utils.noThrow(apiUser.queryRows("select * from " + schemaName + ".tab1"));
                expect(x3.length).toBeGreaterThan(0);
                expect(x3[0].col1).toContain("XXXX");
                let x4 = await io_utils.noThrow(permission.revoke(api));
                expect(x4.errors).toBe(false);
            } finally {
                await apiUser.disconnect();
                await io_utils.noThrow(mpolicy.delete(api));
            }
        } finally {
            await io_utils.noThrow(helper.DBHelper.cleanUpSchemaSS(apiAdminPassthrough, schemaName));
            apiAdminPassthrough.disconnect();
        }
    });

});

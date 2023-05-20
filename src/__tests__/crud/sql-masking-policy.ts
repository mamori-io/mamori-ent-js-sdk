import { MamoriService } from '../../api';
import * as https from 'https';
import { SQLMaskingPolicy } from '../../sql-masking-policy';
import { Role } from '../../role';
import { User } from '../../user';
import { DatasourcePermission, DB_PERMISSION, MamoriPermission, MAMORI_PERMISSION, PolicyPermission } from '../../permission';
import { handleAPIException, noThrow, ignoreError, FILTER_OPERATION } from '../../utils';
import { Datasource } from '../../datasource';
import { ServerSession } from '../../server-session';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("sql-masking-policy crud tests", () => {

    let api: MamoriService;
    let dsName = "maskingPolicyDS" + testbatch;
    let ds: Datasource | null = null;
    let testRole = "test_sql_masking_user_role" + testbatch;
    let grantee = "test_sql-masking_user." + testbatch;
    let granteepw = "J{J'vpKs!$nas!23(6A,4!98712_vdQ'}D"
    let admin = "test_sql-masking_admin." + testbatch;
    let adminpw = "J{J'vpKs!$sadmins!23(6A,12_vdQ'}D"


    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        //Admin user
        let adminU = new User(admin).withEmail("usertest@ace.com").withFullName("Policy User");
        await ignoreError(adminU.delete(api));
        let res4 = await noThrow(adminU.create(api, adminpw));
        expect(res4.error).toBe(false);
        let res5 = await noThrow(new Role("mamori_admin").grantTo(api, admin, false));
        expect(res5.errors).toBe(false);

        //Policy User
        let policyU = new User(grantee).withEmail("usertest@ace.com").withFullName("Policy User");
        await ignoreError(policyU.delete(api));
        let res2 = await noThrow(policyU.create(api, granteepw));
        expect(res2.error).toBe(false);




        if (dbPassword) {
            let ds = new Datasource(dsName);
            ds.ofType("POSTGRESQL", 'postgres')
                .at(dbHost, Number(dbPort))
                .withCredentials('postgres', dbPassword)
                .withDatabase('mamorisys')
                .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
            await ignoreError(ds.delete(api));
            let res = await noThrow(ds.create(api));
            expect(res.error).toBe(false);
            //Make a role
            let role = new Role(testRole);
            await ignoreError(role.delete(api));
            await ignoreError(role.create(api));
            //Grant credential
            let ccred = await noThrow(ds.addCredential(api, testRole, 'postgres', dbPassword));
            expect(ccred.error).toBe(false);
            //grant role to user
            let r2 = await noThrow(role.grantTo(api, admin, false));
            expect(r2.errors).toBe(false);
            let r3 = await noThrow(role.grantTo(api, grantee, false));
            expect(r3.errors).toBe(false);
            // Grant ALL
            let p1 = await noThrow(new DatasourcePermission()
                .on(ds.name, "*", "*", "")
                .permissions([DB_PERMISSION.CREATE_TABLE, DB_PERMISSION.DROP_TABLE])
                .grantee(admin)
                .grant(api));
            expect(p1.errors).toBe(false);
            let p2 = await noThrow(new DatasourcePermission()
                .on(ds.name, "*", "*", "*")
                .permissions([DB_PERMISSION.INSERT, DB_PERMISSION.SELECT, DB_PERMISSION.DELETE])
                .grantee(testRole)
                .grant(api));
            expect(p2.errors).toBe(false);
            let p3 = await noThrow(new DatasourcePermission()
                .on(ds.name, "*", "", "")
                .permission(DB_PERMISSION.MASKED)
                .grantee(testRole)
                .grant(api));
            expect(p3.errors).toBe(false);

        }
    });

    afterAll(async () => {
        await api.delete_user(admin);
        await api.delete_user(grantee);
        await ignoreError(new Role(testRole).delete(api));
        if (ds) {
            await ignoreError(ds.delete(api));
        }
        await api.logout();
    });

    test('masking policy 001', async () => {
        let name = "test_sql-masking.policy._" + testbatch;
        let o = new SQLMaskingPolicy(name);
        o.priority = 100;
        await noThrow(o.delete(api));
        let x = await noThrow(o.create(api));
        expect(x.error).toBe(false);

        let r = await noThrow(SQLMaskingPolicy.list(api, 0, 10, [["name", FILTER_OPERATION.EQUALS_STRING, o.name]]));
        expect(r.totalCount).toBe(1);
        let x3 = await noThrow(SQLMaskingPolicy.get(api, name));
        expect(x3).toBeDefined();

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "POLICY"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        ["policy", FILTER_OPERATION.EQUALS_STRING, name]];
        let res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        //Grant a policy
        let x4 = await noThrow(o.grantTo(api, grantee));
        expect(x4.errors).toBe(false);
        let res2 = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(1);
        //Revoke a policy
        let x5 = await noThrow(o.revokeFrom(api, grantee));
        expect(x5.errors).toBe(false);
        let res3 = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res3.totalCount).toBe(0);

        //Add masking rules
        //GRANT AGAIN - to test delete removes permissions
        let x6 = await noThrow(o.grantTo(api, grantee));
        expect(x6.errors).toBe(false);

        //Delete Policy
        let d0 = await noThrow(o.delete(api));
        expect(d0.error).toBe(false);
        let d2 = await noThrow(SQLMaskingPolicy.list(api, 0, 10, [["name", FILTER_OPERATION.EQUALS_STRING, o.name]]));
        expect(d2.totalCount).toBe(0);
        //Check permissions gone
        let res4 = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res4.totalCount).toBe(0);
    });

    test('masking policy 002', async () => {
        if (dbPassword) {
            let apiAsAdmin = new MamoriService(host, INSECURE);
            await apiAsAdmin.login(admin, adminpw);
            let x = await noThrow(ServerSession.setPassthrough(apiAsAdmin, dsName));
            expect(x.errors).toBe(false);

            let apiAsAPIUser = new MamoriService(host, INSECURE);
            await apiAsAPIUser.login(grantee, granteepw);
            let x2 = await noThrow(ServerSession.setPassthrough(apiAsAPIUser, dsName));
            expect(x2.errors).toBe(false);
            let schemaName = 'testschema' + testbatch;
            try {
                //Create the schema, table and insert data
                let q1 = await noThrow(apiAsAdmin.select("DROP SCHEMA " + schemaName + " CASCADE"));
                let q2 = await noThrow(apiAsAdmin.select("CREATE SCHEMA " + schemaName));
                let q3 = await noThrow(apiAsAdmin.select("CREATE TABLE " + schemaName + ".TAB1 (col1 varchar(50),col2 varchar(50))"));
                let q4 = await noThrow(apiAsAdmin.select("INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value1','value2')"));


                //Create masking policy & masking rule
                let name = "test_002_SqlMaskingPolicy_" + testbatch;
                let o = new SQLMaskingPolicy(name);
                await ignoreError(o.delete(api));
                let q7 = await noThrow(o.create(api));
                expect(q7.errors).toBeUndefined();
                let q8 = await noThrow(o.addColumnRule(api, dsName + ".*." + schemaName + ".tab1", "col1", "masked by full()"));
                expect(q8.errors).toBe(false);
                let q9 = await noThrow(o.listColumnRules(api));
                expect(q9.totalCount).toBe(1);

                let q5 = await noThrow(apiAsAdmin.select("select * from " + schemaName + ".TAB1"));
                expect(q5[0].col1).toBe("value1");
                let q13 = await noThrow(apiAsAPIUser.select("select * from " + schemaName + ".TAB1"));
                expect(q13[0].col1).toBe("value1");

                let q11 = await noThrow(o.grantTo(api, testRole));
                expect(q11.errors).toBe(false);
                let q12 = await noThrow(apiAsAdmin.select("select * from " + schemaName + ".TAB1"));
                expect(q12[0].col1).toBe("XXXXXX");
                let q14 = await noThrow(apiAsAPIUser.select("select * from " + schemaName + ".TAB1"));
                expect(q14[0].col1).toBe("XXXXXX");

            }
            finally {
                //DROP TEST SCHEMA
                let q6 = await noThrow(apiAsAdmin.select("DROP SCHEMA " + schemaName + " CASCADE"));
                await apiAsAPIUser.logout();
                await apiAsAdmin.logout();
            }
        }

    });






});

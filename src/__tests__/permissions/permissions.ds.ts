import { MamoriService } from '../../api';
import * as https from 'https';
import { DatasourcePermission, DB_PERMISSION, RolePermission, TIME_UNIT } from '../../permission';
import { FILTER_OPERATION, handleAPIException, ignoreError, noThrow } from '../../utils';
import { Role } from '../../role';
import { Datasource } from '../../datasource';
import { setPassthroughPermissions } from '../subroutines/ds';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("datasource permission tests", () => {

    let api: MamoriService;
    let grantee = "test_apiuser_permission_.ds" + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"


    beforeAll(async () => {
        console.log("login %s %s", host, username);
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
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await api.logout();
    });

    test('grant 01', async done => {
        let obj = new DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "SELECT"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new DatasourcePermission().grantee(grantee).list(api, filter);
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

    test('grant 01.01 Schema level', async done => {
        let obj = new DatasourcePermission()
            .on("*", "*", "*", "")
            .permission(DB_PERMISSION.CREATE_TABLE)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, DB_PERMISSION.CREATE_TABLE],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new DatasourcePermission().grantee(grantee).list(api, filter);
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

    test('grant 01.02 Database level', async done => {
        let obj = new DatasourcePermission()
            .on("*", "*", "", "")
            .permission(DB_PERMISSION.CREATE_SCHEMA)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, DB_PERMISSION.CREATE_SCHEMA],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new DatasourcePermission().grantee(grantee).list(api, filter);
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

    test('grant 01.03 Datasource level', async done => {
        let obj = new DatasourcePermission()
            .on("*", "", "", "")
            .permission(DB_PERMISSION.MASKED)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, DB_PERMISSION.MASKED],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new DatasourcePermission().grantee(grantee).list(api, filter);
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
        let resp = await noThrow(new DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, DB_PERMISSION.SELECT],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        ["time_left", ">", 3500]
        ];
        let res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new DatasourcePermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        done();

    });

    test('grant 03.01 past date range', async done => {
        let obj = new DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidBetween("2022-01-01 00:00", "2022-01-15 00:00");

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(true);

        await ignoreError(obj.revoke(api));
        done();
    });

    test('grant 03 - valid between', async done => {

        let dt = new Date();
        let year = dt.getFullYear();
        let month = (dt.getMonth() + 1).toString().padStart(2, '0');
        let day = dt.getDate().toString().padStart(2, '0');
        let today = year + "-" + month + "-" + day;
        let fromD = today + " 00:00";
        let toD = today + " 23:59:59";
        let obj = new DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidBetween(fromD, toD);

        await ignoreError(obj.revoke(api));
        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        //Check if permissions exist for grantee
        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, DB_PERMISSION.SELECT],
        ["valid_from", "=", (new Date(fromD)).toISOString()],
        ["valid_until", "=", (new Date(toD)).toISOString()]];
        let res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let data = res.data[0];
        expect(data.permissiontype).toBe(DB_PERMISSION.SELECT);

        let x = await noThrow(obj.grant(api));
        expect(x.errors).toBe(true);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        let res2 = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(0);

        done();
    });

    test('grant 01.01', async done => {
        let obj = new DatasourcePermission()
            .on("ss2016", "mamoritest", "dbo", "customer_pii")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee);
        //make sure no exist
        await ignoreError(obj.revoke(api));
        // Test to check the query is working correctly
        let res = await noThrow(api.grantee_object_grants(grantee, DB_PERMISSION.SELECT, "ss2016.mamoritest.dbo.customer_pii"));
        expect(res.length).toBe(0);
        done();
    });

    test('test 04.01 grant mix case', async done => {

        //Ensure main admin also has db creds to be able to grant
        await ignoreError(new RolePermission().role("DB_CREDS").grantee(username).grant(api));
        //User needs creds and permissions on target DB
        let rp = new RolePermission().role("DB_CREDS").grantee("grantee");
        await noThrow(rp.grant(api));

        //let p = await noThrow(new RolePermission().role("DB_CREDS").grantee(grantee).grant(api));
        //console.log("****1 %o", p);
        let obj = new DatasourcePermission()
            .on("ss2016", "mamori", "dev", "customer_pii")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee);

        let obj2 = new DatasourcePermission()
            .on("Ss2016", "Mamori", "Dev", "CUSTOMER_pii")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));
        await ignoreError(obj2.revoke(api));

        let r1 = await noThrow(obj.grant(api));
        expect(r1.errors).toBe(false);
        let r2 = await noThrow(obj2.grant(api));
        expect(r2.errors).toBe(true);

        //make sure no exist
        await ignoreError(obj.revoke(api));
        await ignoreError(obj2.revoke(api));

        done();
    });

    test('test 05 role grant', async done => {
        let roleName = "test_permission_ds_." + testbatch;
        let role = new Role(roleName);
        await ignoreError(role.delete(api));
        let x = await noThrow(role.create(api));
        expect(x.error).toBe(false);
        //
        let obj = new DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(DB_PERMISSION.SELECT)
            .grantee(role.roleid);
        //make sure no exist
        await ignoreError(obj.revoke(api));
        //
        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "SELECT"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, role.roleid]];
        let res = await new DatasourcePermission().grantee(role.roleid).list(api, filter);
        //Check permission no there
        expect(res.totalCount).toBe(0);
        //Grant
        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //Test Grant
        let res2 = await new DatasourcePermission().grantee(role.roleid).list(api, filter);
        expect(res2.totalCount).toBe(1);
        //Ensure re-grant fails
        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);
        //Revoke
        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //Test re-grant
        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //Revoke
        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //Delete role
        let d = await noThrow(role.delete(api));
        expect(d.error).toBe(false);

        done();
    });


    test.skip('test 06 select limit', async done => {
        //Create object with 5 rows
        //Grant select 
        if (dbPassword) {
            //******SETUP
            //CREATE DS TO LOCAL PG
            let dsHost = "localhost";
            let dsport = "54321";
            let dsUser = "postgres";
            let dsDBPW = dbPassword;
            let dsDB = "postgres";
            let dsName = "test_p_006_local_pg" + testbatch;
            let rName = dsName + "_006_role" + testbatch;
            //
            let ds = new Datasource(dsName);
            await ignoreError(ds.delete(api));
            ds.ofType("POSTGRESQL", 'postgres')
                .at(dsHost, dsport)
                .withCredentials(dsUser, dsDBPW)
                .withDatabase(dsDB);
            let res = await noThrow(ds.create(api));
            expect(res.error).toBe(false);
            try {
                //
                // Create new role
                //
                let dsRole = new Role(rName);
                await ignoreError(dsRole.delete(api));
                let r4 = await noThrow(dsRole.create(api));
                expect(r4.errors).toBeUndefined();
                //Add Credential to role
                let r1 = await noThrow(ds.addCredential(api, dsRole.roleid, dsUser, dsDBPW));
                expect(r1.error).toBe(false);
                //add connect permissions to role
                await setPassthroughPermissions(api, dsRole.roleid, ds.name);
                //Grant to users
                let r5 = await noThrow(dsRole.grantTo(api, username, false));
                expect(r5.errors).toBe(false);
                let r6 = await noThrow(dsRole.grantTo(api, grantee, false));
                expect(r6.errors).toBe(false);




            } finally {
                await ignoreError(ds.delete(api));
                await ignoreError(new Role(rName).delete(api));
            }


            //CREATE ROLE & GRANT PERMISSIONS
            //SET PASSTHROUGH
            //CREATE TABLE AND DATA

            //***** TEST
            //CREATE ROLE WITH LIMIT
            //SELECT FROM DATA

        }


        done();
    });


});

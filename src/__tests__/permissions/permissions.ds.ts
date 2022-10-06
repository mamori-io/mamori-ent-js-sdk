import { MamoriService } from '../../api';
import { io_https, io_utils, io_permission, io_role, io_datasource } from '../../api';
import { setPassthroughPermissions } from '../../__utility__/ds';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("datasource permission tests", () => {

    let api: MamoriService;
    let grantee = "test_apiuser_permission_.ds" + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"


    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        await io_utils.ignoreError(api.delete_user(grantee));
        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(io_utils.handleAPIException(e));
        })
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await api.logout();
    });

    test('grant 01', async done => {
        let obj = new io_permission.DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(grantee);

        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, "SELECT"],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        done();
    });

    test('grant 01.01 Schema level', async done => {
        let obj = new io_permission.DatasourcePermission()
            .on("*", "*", "*", "")
            .permission(io_permission.DB_PERMISSION.CREATE_TABLE)
            .grantee(grantee);

        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, io_permission.DB_PERMISSION.CREATE_TABLE],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        done();
    });

    test('grant 01.02 Database level', async done => {
        let obj = new io_permission.DatasourcePermission()
            .on("*", "*", "", "")
            .permission(io_permission.DB_PERMISSION.CREATE_SCHEMA)
            .grantee(grantee);

        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, io_permission.DB_PERMISSION.CREATE_SCHEMA],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        done();
    });

    test('grant 01.03 Datasource level', async done => {
        let obj = new io_permission.DatasourcePermission()
            .on("*", "", "", "")
            .permission(io_permission.DB_PERMISSION.MASKED)
            .grantee(grantee);

        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, io_permission.DB_PERMISSION.MASKED],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        done();
    });

    test('grant 02', async done => {
        let resp = await io_utils.noThrow(new io_permission.DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidFor(60, io_permission.TIME_UNIT.MINUTES)
            .grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, io_permission.DB_PERMISSION.SELECT],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee],
        ["time_left", ">", 3500]
        ];
        let res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await io_utils.noThrow(new io_permission.DatasourcePermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        done();

    });

    test('grant 03.01 past date range', async done => {
        let obj = new io_permission.DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidBetween("2022-01-01 00:00", "2022-01-15 00:00");

        await io_utils.ignoreError(obj.revoke(api));

        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(true);

        await io_utils.ignoreError(obj.revoke(api));
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
        let obj = new io_permission.DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidBetween(fromD, toD);

        await io_utils.ignoreError(obj.revoke(api));
        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        //Check if permissions exist for grantee
        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, io_permission.DB_PERMISSION.SELECT],
        ["valid_from", "=", (new Date(fromD)).toISOString()],
        ["valid_until", "=", (new Date(toD)).toISOString()]];
        let res = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let data = res.data[0];
        expect(data.permissiontype).toBe(io_permission.DB_PERMISSION.SELECT);

        let x = await io_utils.noThrow(obj.grant(api));
        expect(x.errors).toBe(true);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        let res2 = await new io_permission.DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(0);

        done();
    });

    test('grant 01.01', async done => {
        let obj = new io_permission.DatasourcePermission()
            .on("ss2016", "mamoritest", "dbo", "customer_pii")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(grantee);
        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));
        // Test to check the query is working correctly
        let res = await io_utils.noThrow(api.grantee_object_grants(grantee, io_permission.DB_PERMISSION.SELECT, "ss2016.mamoritest.dbo.customer_pii"));
        expect(res.length).toBe(0);
        done();
    });

    test('test 04.01 grant mix case', async done => {

        //Ensure main admin also has db creds to be able to grant
        await io_utils.ignoreError(new io_permission.RolePermission().role("DB_CREDS").grantee(username).grant(api));
        //User needs creds and permissions on target DB
        let rp = new io_permission.RolePermission().role("DB_CREDS").grantee("grantee");
        await io_utils.noThrow(rp.grant(api));

        //let p = await io_utils.noThrow(new RolePermission().role("DB_CREDS").grantee(grantee).grant(api));
        //console.log("****1 %o", p);
        let obj = new io_permission.DatasourcePermission()
            .on("ss2016", "*", "dev", "customer_pii")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(grantee);

        let obj2 = new io_permission.DatasourcePermission()
            .on("Ss2016", "*", "Dev", "CUSTOMER_pii")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(grantee);

        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));
        await io_utils.ignoreError(obj2.revoke(api));

        let r1 = await io_utils.noThrow(obj.grant(api));
        expect(r1.errors).toBe(false);
        let r2 = await io_utils.noThrow(obj2.grant(api));
        expect(r2.errors).toBe(true);

        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));
        await io_utils.ignoreError(obj2.revoke(api));

        done();
    });

    test('test 05 role grant', async done => {
        let roleName = "test_permission_ds_." + testbatch;
        let role = new io_role.Role(roleName);
        await io_utils.ignoreError(role.delete(api));
        let x = await io_utils.noThrow(role.create(api));
        expect(x.error).toBe(false);
        //
        let obj = new io_permission.DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(io_permission.DB_PERMISSION.SELECT)
            .grantee(role.roleid);
        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));
        //
        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, "SELECT"],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, role.roleid]];
        let res = await new io_permission.DatasourcePermission().grantee(role.roleid).list(api, filter);
        //Check permission no there
        expect(res.totalCount).toBe(0);
        //Grant
        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //Test Grant
        let res2 = await new io_permission.DatasourcePermission().grantee(role.roleid).list(api, filter);
        expect(res2.totalCount).toBe(1);
        //Ensure re-grant fails
        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);
        //Revoke
        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //Test re-grant
        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //Revoke
        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //Delete role
        let d = await io_utils.noThrow(role.delete(api));
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
            let ds = new io_datasource.Datasource(dsName);
            await io_utils.ignoreError(ds.delete(api));
            ds.ofType("POSTGRESQL", 'postgres')
                .at(dsHost, dsport)
                .withCredentials(dsUser, dsDBPW)
                .withDatabase(dsDB);
            let res = await io_utils.noThrow(ds.create(api));
            expect(res.error).toBe(false);
            try {
                //
                // Create new role
                //
                let dsRole = new io_role.Role(rName);
                await io_utils.ignoreError(dsRole.delete(api));
                let r4 = await io_utils.noThrow(dsRole.create(api));
                expect(r4.errors).toBeUndefined();
                //Add Credential to role
                let r1 = await io_utils.noThrow(ds.addCredential(api, dsRole.roleid, dsUser, dsDBPW));
                expect(r1.error).toBe(false);
                //add connect permissions to role
                await setPassthroughPermissions(api, dsRole.roleid, ds.name);
                //Grant to users
                let r5 = await io_utils.noThrow(dsRole.grantTo(api, username, false));
                expect(r5.errors).toBe(false);
                let r6 = await io_utils.noThrow(dsRole.grantTo(api, grantee, false));
                expect(r6.errors).toBe(false);




            } finally {
                await io_utils.ignoreError(ds.delete(api));
                await io_utils.ignoreError(new io_role.Role(rName).delete(api));
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

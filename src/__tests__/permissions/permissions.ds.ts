import { MamoriService } from '../../api';
import * as https from 'https';
import { DatasourcePermission, DB_PERMISSION, RolePermission, TIME_UNIT } from '../../permission';
import { handleAPIException, ignoreError, noThrow } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("datasource permission tests", () => {

    let api: MamoriService;
    let grantee = "test_apiuser_permission_ds" + testbatch;
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

        let filter = [["permissiontype", "equals", "SELECT"],
        ["grantee", "equals", grantee]];
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

        let filter = [["permissiontype", "equals", DB_PERMISSION.SELECT],
        ["grantee", "equals", grantee],
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

    test.skip('grant 03.01 past date range', async done => {
        let obj = new DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidBetween("2022-01-01 00:00", "2022-01-15 00:00");

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(true);
    });

    test.skip('grant 03', async done => {

        let dt = new Date(new Date().setHours(0, 0, 0, 0)).toISOString().split("T");
        let today = dt[0];
        let fromD = today + " 00:00";
        let toD = today + " 23:59:59";
        console.log("%s %s", fromD, toD)

        let obj = new DatasourcePermission()
            .on("*", "*", "*", "*")
            .permission(DB_PERMISSION.SELECT)
            .grantee(grantee)
            .withValidBetween(fromD, toD);

        await ignoreError(obj.revoke(api));
        let resp = await noThrow(obj.grant(api));
        //console.log(resp);
        expect(resp.errors).toBe(false);

        //["valid_from", "=", '2021-12-31 13:00:00'],
        let filter = [["permissiontype", "equals", DB_PERMISSION.SELECT],
        ["valid_from", "=", fromD + '.000000Z'],
        ["valid_until", "=", toD + '.000000Z']];
        let res = await new DatasourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let data = res.data[0];
        expect(data.permissiontype).toBe(DB_PERMISSION.SELECT);
        let id = data.id;
        console.log("%s : %s", data.time_left, data.time_until);
        //let r2 = await noThrow(api.grantee_object_grants(grantee, DB_PERMISSION.SELECT, "*.*.*.*"));
        //console.log(r2);

        /*
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        */
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
        //User needs creds and permissions on target DB
        let p = ignoreError(new RolePermission().role("DB_CREDS").grantee(grantee).grant(api));

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

});

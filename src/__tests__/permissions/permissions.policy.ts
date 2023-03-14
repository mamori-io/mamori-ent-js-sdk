import { MamoriService } from '../../api';
import * as https from 'https';
import { PolicyPermission, TIME_UNIT } from '../../permission';
import { FILTER_OPERATION, handleAPIException, ignoreError, noThrow } from '../../utils';
import { Role } from '../../role';
import { DBHelper } from '../../__utility__/test-helper';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("policy permission tests", () => {

    let api: MamoriService;
    let policy = "test_fake_policy" + testbatch;
    let grantee = "test_apiuser_policy." + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //create the user
        await ignoreError(api.delete_user(grantee));
        let result = await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        });
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await api.logout();
    });

    test('grant 01', async () => {
        let obj = new PolicyPermission()
            .policy(policy)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "POLICY"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        ["policy", FILTER_OPERATION.EQUALS_STRING, policy]];
        let res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);

    });

    test('grant 02', async () => {

        let resp = await noThrow(new PolicyPermission()
            .policy(policy)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "POLICY"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        ["policy", FILTER_OPERATION.EQUALS_STRING, policy],
        ["time_left", ">", 3500]
        ];
        let res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new PolicyPermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

    });

    test('grant 03', async () => {
        let dr = DBHelper.dateRange();



        let obj = await new PolicyPermission()
            .policy(policy)
            .grantee(grantee)
            .withValidBetween(dr.fromDtz, dr.toDtz);

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "POLICY"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        ["policy", FILTER_OPERATION.EQUALS_STRING, policy],
        ["valid_from", "=", (new Date(dr.fromD)).toISOString()],
        ["valid_until", "=", (new Date(dr.toD)).toISOString()]
        ];
        let res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);

        let res2 = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(0);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);
    });

    test('grant 04 - mixed case', async () => {
        let name = "CAPS" + policy;
        let objMixedCase = new PolicyPermission()
            .policy(name)
            .grantee(grantee);
        let objLower = new PolicyPermission()
            .policy(name.toLowerCase())
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
        //
        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "POLICY"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee]];
        let r5 = await noThrow(new PolicyPermission().grantee(grantee).list(api, filter));
        expect(r5.totalCount).toBe(0);
        //
    });

    test('test 05 role grant', async () => {
        let roleName = "test_permission_policy_." + testbatch;
        let role = new Role(roleName);
        await ignoreError(role.delete(api));
        let x = await noThrow(role.create(api));
        expect(x.error).toBe(false);
        //
        // GRANT
        //
        let obj = new PolicyPermission()
            .policy(policy)
            .grantee(roleName);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, "POLICY"],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, roleName],
        ["policy", FILTER_OPERATION.EQUALS_STRING, policy]];
        let res = await new PolicyPermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(0);

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new PolicyPermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);


        //Delete role
        let d = await noThrow(role.delete(api));
        expect(d.error).toBe(false);
    });


});

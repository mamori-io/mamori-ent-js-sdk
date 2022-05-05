import { MamoriService } from '../../api';
import * as https from 'https';
import { SQLMaskingPolicy } from '../../sql-masking-policy';
import { Role } from '../../role';
import { User } from '../../user';
import { MamoriPermission, MAMORI_PERMISSION, PolicyPermission } from '../../permission';
import { handleAPIException, noThrow, ignoreError, FILTER_OPERATION } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("sql-masking-policy crud tests", () => {

    let api: MamoriService;
    let apiAsAgent: MamoriService;
    let apiAsAPIUser: MamoriService;
    let testRole = "test_sql-masking_user_role" + testbatch;
    let grantee = "test_sql-masking_user." + testbatch;
    let granteepw = "J{J'vpKs!$nas!23(6A,4!98712_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //User
        let policyU = new User(grantee).withEmail("usertest@ace.com").withFullName("Policy User");
        await ignoreError(policyU.delete(api));
        let res2 = await noThrow(policyU.create(api, granteepw));
        expect(res2.error).toBe(false);
        //create roles
        await ignoreError(new Role(testRole).delete(api));
        await ignoreError(new Role(testRole).create(api));

        //login in sessions
        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);
    });

    afterAll(async () => {

        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await ignoreError(new Role(testRole).delete(api));
        await api.logout();
    });

    test('sql masking policy 01', async done => {
        let name = "test_sql-masking.policy._" + testbatch;
        let o = new SQLMaskingPolicy(name);
        o.priority = 100;
        await ignoreError(o.delete(api));
        let x = await noThrow(o.create(api));
        expect(x.error).toBe(false);

        let r = await noThrow(SQLMaskingPolicy.list(api, 0, 10, [["name", FILTER_OPERATION.EQUALS_STRING, o.name]]));
        expect(r.totalCount).toBe("1");
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
        expect(d2.totalCount).toBe("0");
        //Check permissions gone
        let res4 = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res4.totalCount).toBe(0);
        done();
    });




});
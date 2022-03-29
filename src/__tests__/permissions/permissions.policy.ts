import { MamoriService } from '../../api';
import * as https from 'https';
import { PolicyPermission, TIME_UNIT } from '../../permission';
import { handleAPIException, ignoreError, noThrow } from '../../utils';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("policy permission tests", () => {

    let api: MamoriService;
    let policy = "test_fake_policy" + testbatch;
    let grantee = "test_apiuser_policy" + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //create the user
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

    test('grant 01', async done => {
        let obj = new PolicyPermission()
            .policy(policy)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));

        let filter = [["permissiontype", "equals", "POLICY"],
        ["grantee", "equals", grantee],
        ["policy", "equals", policy]];
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

        done();

    });

    test('grant 02', async done => {

        let resp = await noThrow(new PolicyPermission()
            .policy(policy)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", "POLICY"],
        ["grantee", "equals", grantee],
        ["policy", "equals", policy],
        ["time_left", ">", 3500]
        ];
        let res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new PolicyPermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

        done();

    });

    test.skip('grant 03', async done => {

        let obj = await new PolicyPermission()
            .policy(policy)
            .grantee(grantee)
            .withValidBetween("2022-01-01 00:00", "2022-01-15 00:00");

        await ignoreError(obj.revoke(api));

        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", "equals", "POLICY"],
        ["grantee", "equals", grantee],
        ["policy", "equals", policy],
        ["valid_until", "=", '2022-01-14 13:00:00'],
        ["valid_from", "=", '2021-12-31 13:00:00'],
        ];
        let res = await new PolicyPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.all(false).revoke(api));
        expect(resp.errors).toBe(false);
        done();

    });

    test.skip('grant 04 - mixed case', async done => {
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
        //revoke 2
        let r4 = await noThrow(objLower.revoke(api));
        expect(r4.errors).toBe(false);
        //
        done();
    });


});
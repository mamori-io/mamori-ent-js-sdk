import { MamoriService } from '../../api';
import * as https from 'https';
import { IPResourcePermission, TIME_UNIT } from '../../permission';
import { handleAPIException, ignoreError, noThrow } from '../../utils';



const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("ip resource permission tests", () => {

    let api: MamoriService;
    let resource = "webaccess" + testbatch;
    let permType = "IP USAGE";
    let grantee = "test_apiuser_ip" + testbatch;
    let granteepw = "J{J'vpKsn3213W6(6A,4_vdQ'}D"

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
        })
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await api.logout();

    });

    test('grant 01', async done => {
        let obj = new IPResourcePermission()
            .resource(resource)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));
        //check list
        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee]];
        let res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        //grant
        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //check list
        res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        //try re-grant
        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);
        //revoke
        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //
        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        done();
    });

    test('grant 02', async done => {
        let r1 = await new IPResourcePermission()
            .resource(resource)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api);

        expect(r1.errors).toBe(false);

        let filter = [["permissiontype", "equals", permType],
        ["grantee", "equals", grantee],
        ["key_name", "equals", resource],
        ["time_left", ">", 3500]
        ];

        let res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new IPResourcePermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        done();

    });

    test('grant 03 - mixed case', async done => {
        let name = "CAPS" + resource;
        let objMixedCase = new IPResourcePermission()
            .resource(name)
            .grantee(grantee);
        let objLower = new IPResourcePermission()
            .resource(name.toLowerCase())
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

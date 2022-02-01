import { MamoriService } from '../../../dist/api';
import * as https from 'https';
import { IPResourcePermission } from '../../../dist/permission';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("ip resource permission tests", () => {

    let api: MamoriService;
    let resource = "webaccess";
    let permType = "IP USAGE";
    let grantee = "test_apiuser_ip";
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
            console.log(e.response.data);
        })
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await api.logout();

    });

    test('grant 01', async done => {
        try {

            let obj = new IPResourcePermission()
                .resource(resource)
                .grantee(grantee);

            //make sure no exist
            await obj.revoke(api);

            let filter = [["permissiontype", "equals", permType],
            ["grantee", "equals", grantee]];
            let res = await new IPResourcePermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(0);

            let resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            res = await new IPResourcePermission().grantee(grantee).list(api, filter);
            res = await new IPResourcePermission().grantee(grantee).list(api, filter);
            expect(res.totalCount).toBe(1);

            let resp2 = await obj.grant(api);
            expect(resp2.errors).toBe(true);

            resp = await obj.revoke(api);
            expect(resp.errors).toBe(false);

            resp = await obj.grant(api);
            expect(resp.errors).toBe(false);

            resp = await obj.revoke(api);
            expect(resp.errors).toBe(false);


            done();
        } catch (e) {
            done(e);
        }
    });

});

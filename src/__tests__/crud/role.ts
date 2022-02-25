import { MamoriService } from '../../api';
import * as https from 'https';
import { Role } from '../../role';
import { handleAPIException, noThrow, ignoreError } from '../../utils';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("role tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_roles";
    let granteepw = "J{J'vpKs!$nW6(6A,4!98712_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        })

        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);

    });

    afterAll(async () => {
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    test('role 01', async done => {
        let k = new Role("test_automated_role");

        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api));
        expect(res.error).toBe(false);

        //Ensure key returned properly
        let x = (await noThrow(Role.getAll(api))).filter((o: any) => o.roleid == k.roleid);
        expect(x.length).toBe(1);

        //Ensure non-admins can't see any keys
        let x2 = (await noThrow(Role.getGrantedRoles(apiAsAPIUser, grantee))).filter((o: any) => o.roleid == k.roleid);
        expect(x2.length).toBe(0);
        //Grant to user
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3.error).toBe(false);
        //Ensure user can see the role
        let x4 = (await noThrow(Role.getGrantedRoles(apiAsAPIUser, grantee))).filter((o: any) => o.roleid == k.roleid);
        expect(x4.length).toBe(1);
        //Ensure user can't delete the item
        let resDel2 = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBe(500);
        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5.error).toBe(false);
        //Ensure the role was revoked
        let x6 = (await noThrow(Role.getGrantedRoles(apiAsAPIUser))).filter((o: any) => o.roleid == k.roleid);
        expect(x6.length).toBe(0);
        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.error).toBe(false);

        done();
    });

});
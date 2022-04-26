import { MamoriService } from '../../api';
import * as https from 'https';
import { User } from '../../user';
import { ServerSession } from '../../server-session';
import { MamoriPermission, MAMORI_PERMISSION, PolicyPermission, RolePermission, TIME_UNIT } from '../../permission';
import { handleAPIException, ignoreError, noThrow } from '../../utils';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("masking policy tests", () => {

    let api: MamoriService;

    let user: User;
    let grantee = "test_apiuser-session." + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);

        await api.login(username, password);
        //create the user
        user = new User(grantee).withEmail("test@.test.com");
        await ignoreError(user.delete(api));
        await user.create(api, granteepw).catch(e => {
            fail(handleAPIException(e));
        });
    });

    afterAll(async () => {

        await user.delete(api);
        await api.logout();
    });

    test('set passthrough', async done => {
        let apiUser: MamoriService = new MamoriService(host, INSECURE);
        try {
            await apiUser.login(user.username, granteepw);
            //SET PASSTHROUGH Should fail since user does not have DB creds for DB
            let x = await noThrow(ServerSession.setPassthrough(apiUser, "oracle193"));
            expect(x.errors).toBe(true);
            //Grant roles with db permissions
            let p = await noThrow(new RolePermission().role("db_creds").grantee(grantee).grant(api));
            expect(p.errors).toBe(false);
            let p2 = await noThrow(new RolePermission().role("db_access").grantee(grantee).grant(api));
            expect(p2.errors).toBe(false);
            let x2 = await noThrow(ServerSession.setPassthrough(apiUser, "oracle193"));
            expect(x2.errors).toBe(false);
        } finally {
            await apiUser.logout();
        }
        done();
    });

});
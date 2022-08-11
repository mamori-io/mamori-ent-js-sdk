import { MamoriService } from '../../api';
import * as https from 'https';
import { LOGIN_PROMPT_MODE, RemoteDesktopLogin, REMOTE_DESKTOP_PROTOCOL } from '../../remote-desktop-login';
import { handleAPIException, noThrow, ignoreError } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("remote desktop login tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_rmdlogin" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!3#$4#12_vdQ'}D";

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

        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);
    });

    afterAll(async () => {
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    test('rmd-rdp login 01', async done => {
        let o = new RemoteDesktopLogin("test_rdp_login" + testbatch, REMOTE_DESKTOP_PROTOCOL.RDP);
        await ignoreError(o.delete(api));
        o.at("host", "port").withLoginMode(LOGIN_PROMPT_MODE.MAMORI_PROMPT);
        //verify to and from json
        let k = o.fromJSON(o.toJSON());
        let res = await noThrow(k.create(api));
        expect(res.error).toBe(false);
        //Get Details Call
        let x = await noThrow(RemoteDesktopLogin.getByName(api, k.name));
        expect(x._id).toBeDefined();
        //let x2 = await noThrow(RemoteDesktopLogin.getByName(apiAsAPIUser, k.name));
        //expect(x2.errors).toBe(true);
        //List Call
        let x3 = await noThrow(RemoteDesktopLogin.list(api, 0, 10, [["name", "=", k.name]]));
        expect(x3.data.length).toBe(1);
        let x4 = await noThrow(RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
        expect(x4.data.length).toBe(0);
        //Grant permission to user
        let x5 = await noThrow(k.grantTo(api, grantee));
        expect(x5.errors).toBe(false);
        let x6 = await noThrow(RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));

        expect(x6.data.length).toBe(1);
        //Ensure user can't delete a key
        let resDel2 = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x7 = await noThrow(k.revokeFrom(api, grantee));

        expect(x7.errors).toBe(false);
        let x8 = await noThrow(RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));

        expect(x8.data.length).toBe(0);
        //Delete
        let x9 = await noThrow(k.delete(api));

        expect(x9.error).toBe(false);
        //
        done();
    });









});

import { MamoriService } from '../../dist/api';
import * as https from 'https';
import { ServerSettings } from '../../dist/server-settings';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("Server Settings - bootstrap user", () => {

    let api: MamoriService;
    let apiuser = "test_apiuser_ss";
    let apiuserpw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        await api.create_user({
            username: apiuser,
            password: apiuserpw,
            fullname: apiuser,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            console.log(e.response.data);
        })
    });

    afterAll(async () => {
        await api.delete_user(apiuser);
        await api.logout();
    });

    test('disable bootstrap', async done => {
        try {

            let ss = new ServerSettings(api);
            let result = await ss.setBootstrapAccount(false);
            expect(result.error).toBe(false);
            done();
        } catch (e) {
            done(e);
        }
    });

    test('enable bootstrap', async done => {
        try {

            let ss = new ServerSettings(api);
            let pw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D";
            let result = await ss.setBootstrapAccount(true, pw);
            expect(result.error).toBe(false);

            let api2 = new MamoriService(host, INSECURE);
            try {
                result = await api2.login("root", pw);
                expect(result.session_id).toBeDefined();
            } finally {
                api2.logout();
            }
            result = await ss.setBootstrapAccount(false);
            expect(result.error).toBe(false);

            done();
        } catch (e) {
            done(e);
        }
    });

    test('non-admin user bootstrap', async done => {
        try {

            let apiUser = new MamoriService(host, INSECURE);
            try {
                let loginresult = await apiUser.login(apiuser, apiuserpw);
                expect(loginresult.session_id).toBeDefined();
                let ss = new ServerSettings(apiUser);
                let pw = "J{J'vpKs827-n\/a@C+W6(6A,4_vdQ'}D";
                try {
                    let r = await ss.setBootstrapAccount(true, pw);
                    expect(r).toBeUndefined();
                } catch (e) {
                    console.log("Expected SQL Exception %o", e.response.data);
                    expect(e.response.data.status).toBe("error");
                }

                try {
                    let r = await ss.setBootstrapAccount(false);
                    expect(r).toBeUndefined();
                } catch (e) {
                    console.log("Expected SQL Exception %o", e.response.data);
                    expect(e.response.data.status).toBe("error");
                }
            } finally {
                apiUser.logout();
            }
            done();
        } catch (e) {
            done(e);
        }
    });

});

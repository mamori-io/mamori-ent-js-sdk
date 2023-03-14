import { MamoriService } from '../../api';
import * as https from 'https';
import { ServerSettings } from '../../server-settings';
import { handleAPIException, noThrow, ignoreError } from '../../utils';
import { assert } from 'console';
import { UrlMapping } from 'typedoc';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });


let bootstraptest = process.env.MAMORI_BS_TESTS ? test : test.skip;

describe("Server Settings - bootstrap user", () => {

    let api: MamoriService;
    let apiuser = "t_apiuser_server_settings_" + testbatch;
    let apiuserpw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D";

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        await ignoreError(api.delete_user(apiuser));
        await api.create_user({
            username: apiuser,
            password: apiuserpw,
            fullname: apiuser,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            //console.log(e.response.data);
        })
    });

    afterAll(async () => {
        await api.delete_user(apiuser);
        await api.logout();
    });

    bootstraptest('disable bootstrap', async () => {
        let ss = new ServerSettings(api);
        let result = await ss.setBootstrapAccount(false);
        expect(result.error).toBe(false);
    });

    bootstraptest('enable bootstrap', async () => {
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
    });

    bootstraptest('non-admin user bootstrap', async () => {
        let apiUser = new MamoriService(host, INSECURE);
        try {
            let loginresult = await apiUser.login(apiuser, apiuserpw);
            expect(loginresult.session_id).toBeDefined();
            let ss = new ServerSettings(apiUser);
            let pw = "J{J'vpKs827-n\/a@C+W6(6A,4_vdQ'}D";
            let r = await noThrow(ss.setBootstrapAccount(true, pw));
            expect(r.errors).toBe(true);
            expect(r.response.status).toBe(403);
            let r2 = await noThrow(ss.setBootstrapAccount(false));
            expect(r2.errors).toBe(true);
            expect(r2.response.status).toBe(403);
        } finally {
            apiUser.logout();
        }
    });

    test.skip('set server domain', async () => {
        try {
            //let this.get_smtp_cfg().then((smtpSettings: any)
            let o = new ServerSettings(api);
            //192.0.0.1
            let domain = "192.0.0.1";
            let r = await noThrow(o.setServerDomain(domain));
            if (r && r.length > 0) {
                expect(r[0].length).toBe(0);
                expect(r[1][0]).toBe("ok");
                expect(r[2][0]).toBe("ok");
                expect(r[3].error).toBe(false);
                expect(r[4].error).toBe(false);
            }
        } finally {
            let o2 = new ServerSettings(api);
            let u = new URL(host);
            let r2 = await noThrow(o2.setServerDomain(u.host));
            if (r2 && r2.length > 0) {
                expect(r2[0].length).toBe(0);
                expect(r2[1][0]).toBe("ok");
                expect(r2[2][0]).toBe("ok");
                expect(r2[3].error).toBe(false);
                expect(r2[4].error).toBe(false);
            }
        }
    });


});

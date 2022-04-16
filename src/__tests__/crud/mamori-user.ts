import { MamoriService } from '../../api';
import * as https from 'https';
import { User } from '../../user';
import { DatasourcePermission, DB_PERMISSION, TIME_UNIT } from '../../permission';
import { handleAPIException, noThrow, ignoreError } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("mamori user tests", () => {

    let api: MamoriService;
    let grantee = "test_users_user" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!98712_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

    test('mamori user 01', async done => {
        let k = new User(grantee).withEmail(grantee + "@ace.com").withFullName("Test User");
        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api, granteepw));
        expect(res.error).toBe(false);
        let x = await noThrow(User.get(api, grantee));
        expect(x.username).toBe(grantee);
        //Test connection
        let apiAsAPIUser: MamoriService = new MamoriService(host, INSECURE);
        let x4 = await noThrow(apiAsAPIUser.login(grantee, granteepw));
        expect(x4.username).toBe(grantee);
        ignoreError(apiAsAPIUser.logout());
        //Update email
        k.email = "testit@test.com";
        let x2 = await noThrow(k.update(api));
        expect(x2.error).toBe(false);
        let x3 = await noThrow(User.get(api, grantee));
        expect(x3.email).toBe("testit@test.com");
        let d = await noThrow(k.delete(api));
        expect(res.error).toBe(false);
        done();
    });

    //spaces, periods, dashes, and underscores
    test('mamori user 02 - special characters', async done => {
        let uname = grantee + ".-_TEST";
        let k = new User(uname).withEmail(grantee + "@ace.com").withFullName("Test User");
        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api, granteepw));
        expect(res.error).toBe(false);
        let x = await noThrow(User.get(api, uname));
        expect(x.username).toBe(uname);
        //Test connection
        let apiAsAPIUser: MamoriService = new MamoriService(host, INSECURE);
        let x4 = await noThrow(apiAsAPIUser.login(uname, granteepw));
        expect(x4.username).toBe(uname.toLowerCase());
        ignoreError(apiAsAPIUser.logout());
        //Update email
        k.email = "testit@test.com";
        let x2 = await noThrow(k.update(api));
        expect(x2.error).toBe(false);
        let x3 = await noThrow(User.get(api, uname));
        expect(x3.email).toBe("testit@test.com");
        let d = await noThrow(k.delete(api));
        expect(res.error).toBe(false);
        done();
    });



});
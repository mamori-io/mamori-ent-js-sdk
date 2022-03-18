import { MamoriService } from '../../api';
import * as https from 'https';
import { handleAPIException, noThrow, ignoreError } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });


describe("mamori catalog tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "t_user_catalog" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!@34#12_vdQ'}D" + testbatch;
    //jest.setTimeout(30000);

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

    test('catalog via ws 01', async done => {
        //Select from the connection log
        let sql = "select * from SYS.CONNECTIONS where login_username !='" + grantee + "' limit 10";
        let r = await noThrow(api.simple_query(sql));
        console.log(r);
        done();
    });

});
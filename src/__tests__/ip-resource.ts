import { MamoriService } from '../api';
import * as https from 'https';
import { IpResource } from "../ip-resource";
import { handleAPIException, noThrow, ignoreError } from '../utils';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("IP resource CRUD tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_crud_ip";
    let granteepw = "J{J'vpKs!$nW6(6A,4!@34#12_vdQ'}D";

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

    test('ip list 01', async done => {
        try {
            let results = await IpResource.list(api, 0, 100, [["name", "=", "aSAS"]]);
            //let i = new IpResource("asas");
            //let results = await i.delete(api);
            console.log(results);
        } catch (e) {
            console.log(e);
        }

        done();
    });


});

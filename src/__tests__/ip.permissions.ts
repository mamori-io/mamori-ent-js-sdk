import { MamoriService } from '../../dist/api';
import * as https from 'https';
import { IPResourcePermission } from '../../dist/permission';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("ip resource permission tests", () => {

    let api: MamoriService;
    let resource = "webaccess";
    let grantee = "apiuser1";
    let permType = "IP USAGE";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

});

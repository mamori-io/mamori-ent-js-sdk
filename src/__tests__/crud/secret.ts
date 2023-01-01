import { MamoriService } from '../../api';
import { io_https, io_utils, io_secret } from '../../api';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("Secret CRUD tests", () => {

    let api: MamoriService;
    let resourceName: string = "test_Secret_" + testbatch;

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

    test('secret create 01', async () => {

        let baseR = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, resourceName)
            .withUsername("testUser")
            .withHost("10.123.0.100")
            .withDescription("The Desc");


        // Test to and from JSON
        let r = io_secret.Secret.build(baseR.toJSON());
        //Clean up any prior test
        let d = await io_utils.ignoreError(r.delete(api));
        let r1 = await io_utils.noThrow(r.create(api));
        expect(r1.error).toBe(false);

        let r2 = await io_utils.noThrow(io_secret.Secret.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r2.data.length).toBe(1);
        let y = r2.data[0];
        expect(y.name).toBe(resourceName);

        let r3 = await io_utils.noThrow(r.delete(api));
        expect(r3.error).toBe(false);
        let r4 = await io_utils.noThrow(io_secret.Secret.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r4.data.length).toBe(0);
    });


});

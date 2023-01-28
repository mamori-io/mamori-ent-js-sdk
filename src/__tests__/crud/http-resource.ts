import { MamoriService } from '../../api';
import { io_https, io_utils, io_http_resource } from '../../api';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("HTTP Resource CRUD tests", () => {

    let api: MamoriService;
    let resourceName: string = "test_http_r_" + testbatch;

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

    test('http resource create 01', async () => {
        //Clean up old data
        let d0 = await io_utils.noThrow(io_http_resource.HTTPResource.getByName(api, resourceName));
        if (d0) {
            await io_utils.ignoreError(d0.delete(api));
        }

        let s = new io_http_resource.HTTPResource(resourceName)
            .withURL("https://localhost/minotor")
            .withDescription("Created by Automated Test");

        // Test to and from JSON
        let s0 = io_http_resource.HTTPResource.build(s.toJSON());
        let s1 = await io_utils.noThrow(s0.create(api));
        expect(s1.status).toBe('ok');

        let r2 = await io_utils.noThrow(io_http_resource.HTTPResource.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r2.data.length).toBe(1);
        let y = r2.data[0];
        expect(y.name).toBe(resourceName);

        let w = await io_utils.noThrow(io_http_resource.HTTPResource.getByName(api, resourceName));
        if (w) {
            let w1 = (w as io_http_resource.HTTPResource).withURL("https://localhost/login").withDescription("NewDesc");
            let w2 = await io_utils.noThrow(w1.update(api));
            expect(w2.id).toBeDefined();
            let w3 = (await io_utils.noThrow(io_http_resource.HTTPResource.getByName(api, resourceName)) as io_http_resource.HTTPResource);
            expect(w3.description).toBe("NewDesc");
            expect(w3.url).toBe("https://localhost/login");
        }


        let r = await io_utils.noThrow(new io_http_resource.HTTPResource(resourceName).delete(api));
        expect(r.status).toBe('ok');
        let r4 = await io_utils.noThrow(io_http_resource.HTTPResource.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r4.data.length).toBe(0);
    });


});

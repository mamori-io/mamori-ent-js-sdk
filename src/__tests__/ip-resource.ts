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
    let resourceName: string = "testIPResource";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

    test('ip create 01', async done => {
        let cidr = "10.0.200.0/24";
        let ports = "443,80";
        let baseR = new IpResource(resourceName).withCIDR(cidr).withPorts(ports);
        // Test to and from JSON
        let r = new IpResource("").fromJSON(baseR.toJSON());
        //Clean up any prior test
        let d = await ignoreError(r.delete(api));
        let r1 = await noThrow(r.create(api));
        expect(r1.error).toBe(false);

        let r2 = await noThrow(IpResource.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r2.data.length).toBe(1);
        let y = r2.data[0];
        expect(y.name).toBe(resourceName);
        expect(y.cidr).toBe(cidr);
        expect(y.ports).toBe(ports);

        let r3 = await noThrow(r.delete(api));
        expect(r3.error).toBe(false);

        let r4 = await noThrow(IpResource.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r4.data.length).toBe(0);
        done();

    });


});

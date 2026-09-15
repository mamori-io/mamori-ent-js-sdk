import {
    MamoriService,
    io_https, io_utils, io_providers, io_role
} from '../../api';
import * as helper from '../../__utility__/test-helper';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("Authenication Provider Tests", () => {

    let api: MamoriService;
    let resourceName: string = "testProvider" + testbatch;
    let grantee = "test_apiuser_provider" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!3#$4#12_vdQ'}D";

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //await io_utils.ignoreError(api.delete_user(grantee));
    });

    afterAll(async () => {
        await api.logout();
    });

    test('provider create 01', async () => {
        //let x = await io_utils.noThrow(io_providers.Provider.list(api));
        //console.log("**** %o",x);
        /*
        let cidr = "10.0.200.0/24";
        let ports = "443,80";
        let baseR = new io_ipresource.IpResource(resourceName).withCIDR(cidr).withPorts(ports);
        // Test to and from JSON
        let r = new io_ipresource.IpResource("").fromJSON(baseR.toJSON());
        //Clean up any prior test
        let d = await io_utils.ignoreError(r.delete(api));
        let r1 = await io_utils.noThrow(r.create(api));
        expect(r1).toSucceed();

        let r2 = await io_utils.noThrow(io_ipresource.IpResource.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r2.data.length).toBe(1);
        let y = r2.data[0];
        expect(y.name).toBe(resourceName);
        expect(y.cidr).toBe(cidr);
        expect(y.ports).toBe(ports);

        let r3 = await io_utils.noThrow(r.delete(api));
        expect(r3).toSucceed();
        let r4 = await io_utils.noThrow(io_ipresource.IpResource.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r4.data.length).toBe(0);
        */
    });

    const azureProvider = process.env.MAMORI_AZURE_PROVIDER || "";
    const azureTest = azureProvider ? test : test.skip;

    azureTest("replace_device_token_workflow option round-trip", async () => {
        const got = await io_utils.noThrow(api.get_provider(azureProvider));
        expect(got.errors).toBeFalsy();
        const props = (got && got.properties) || {};
        const providerType = got.provider_type || got.type || "azure";
        const original =
            props.replace_device_token_workflow != null
                ? String(props.replace_device_token_workflow)
                : "false";

        try {
            const setOn = await io_utils.noThrow(
                api.update_provider(azureProvider, {
                    name: azureProvider,
                    type: providerType,
                    replace_device_token_workflow: "true",
                }),
            );
            expect(setOn.errors).toBeFalsy();

            const after = await io_utils.noThrow(api.get_provider(azureProvider));
            expect(after.errors).toBeFalsy();
            const afterProps = (after && after.properties) || {};
            expect(String(afterProps.replace_device_token_workflow)).toBe("true");
        } finally {
            await io_utils.ignoreError(
                api.update_provider(azureProvider, {
                    name: azureProvider,
                    type: providerType,
                    replace_device_token_workflow: original === "true" ? "true" : "false",
                }),
            );
        }
    });

});

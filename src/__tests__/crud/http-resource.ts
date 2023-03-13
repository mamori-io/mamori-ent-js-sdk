import { MamoriService } from '../../api';
import { io_https, io_utils, io_http_resource, io_requestable_resource, io_role, io_user } from '../../api';
import * as helper from '../../__utility__/test-helper';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("HTTP Resource CRUD tests", () => {

    let api: MamoriService;
    let resourceName: string = "test_http_r_" + testbatch;
    let grantee = "test_apiuser_httprsc" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!3#$4#12_vdQ'}D";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        await io_utils.ignoreError(api.delete_user(grantee));
        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(io_utils.handleAPIException(e));
        })

    });

    afterAll(async () => {
        await api.delete_user(grantee);
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
            .withDescription("Created by Automated Test")
            .withExcludeFromPAC(false);

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

    test('rmd-rdp requestable', async () => {
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


        // ROLE
        let policyName = "test_auto_Resource_policy_" + testbatch;
        let endorsementRole = "test_role_for_" + policyName;
        let policy = await helper.Policy.setupResourcePolicy(api, endorsementRole, policyName);

        //REQUESTABLE
        let requestable = new io_requestable_resource.RequestableResource(io_requestable_resource.REQUEST_RESOURCE_TYPE.HTTP_RESOURCE)
            .withResource(resourceName)
            .withGrantee(grantee)
            .withPolicy(policyName);
        await io_utils.noThrow(io_requestable_resource.RequestableResource.deleteByName(api,
            requestable.resource_type, grantee, resourceName, policyName));
        //
        let r1 = await io_utils.noThrow(requestable.create(api));
        expect(r1.error).toBe(false);

        let r2 = await io_utils.noThrow(io_requestable_resource.RequestableResource.getByName(api,
            requestable.resource_type, grantee, resourceName, policyName));
        expect(r2.id).toBeDefined();

        await io_utils.noThrow(r2.delete(api));
        await io_utils.noThrow(policy.delete(api));
        await io_utils.ignoreError(new io_role.Role(endorsementRole).delete(api));

        let d1 = await io_utils.noThrow(io_http_resource.HTTPResource.getByName(api, resourceName));
        if (d1) {
            await io_utils.ignoreError(d1.delete(api));
        }
        //
    });



});

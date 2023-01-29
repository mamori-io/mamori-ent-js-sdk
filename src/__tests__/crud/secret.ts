import { MamoriService } from '../../api';
import { io_https, io_utils, io_secret, io_requestable_resource, io_role } from '../../api';
import * as helper from '../../__utility__/test-helper';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("Secret CRUD tests", () => {

    let api: MamoriService;
    let resourceName: string = "test_Secret_" + testbatch;
    let grantee = "test_apiuser_rmdlogin" + testbatch;
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

    test('secret create 01', async () => {
        //Clean up old data
        let d0 = await io_utils.noThrow(io_secret.Secret.getByName(api, resourceName));
        if (d0) {
            await io_utils.ignoreError(d0.delete(api));
        }

        let s = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, resourceName)
            .withSecret("#(*7322323!!!jnsas@^0001")
            .withUsername("testUser")
            .withHost("10.123.0.100")
            .withDescription("The Desc");

        // Test to and from JSON
        let s0 = io_secret.Secret.build(s.toJSON());
        let s1 = await io_utils.noThrow(s0.create(api));
        expect(s1.status).toBe('OK');

        let r2 = await io_utils.noThrow(io_secret.Secret.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r2.data.length).toBe(1);
        let y = r2.data[0];
        expect(y.name).toBe(resourceName);

        let w = await io_utils.noThrow(io_secret.Secret.getByName(api, resourceName));
        if (w) {
            let w1 = (w as io_secret.Secret).withHost("100.100.100.100").withDescription("NewDesc");
            let w2 = await io_utils.noThrow(w1.update(api));
            expect(w2.status).toBe('OK');
            let w3 = (await io_utils.noThrow(io_secret.Secret.getByName(api, resourceName)) as io_secret.Secret);
            expect(w3.description).toBe("NewDesc");
            expect(w3.hostname).toBe("100.100.100.100");
        }


        let r = await io_utils.noThrow(io_secret.Secret.deleteByName(api, resourceName));
        expect(r.error).toBe(false);
        let r4 = await io_utils.noThrow(io_secret.Secret.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r4.data.length).toBe(0);
    });

    test('secret requestable', async () => {
        let resource = "test_req_secret" + testbatch;
        let s = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, resource)
            .withSecret("#(*7322323!!!jnsas@^0001")
            .withUsername("testUser")
            .withHost("10.123.0.100")
            .withDescription("The Desc");
        // Test to and from JSON
        let s1 = await io_utils.noThrow(s.create(api));
        expect(s1.status).toBe('OK');

        // ROLE
        let policyName = "test_secret_rsc_policy_" + testbatch;
        let endorsementRole = "test_role_for_" + policyName;
        let policy = await helper.Policy.setupResourcePolicy(api, endorsementRole, policyName);

        //REQUESTABLE
        let requestable = new io_requestable_resource.RequestableResource(io_requestable_resource.REQUEST_RESOURCE_TYPE.SECRET)
            .withResource(resource)
            .withGrantee(grantee)
            .withPolicy(policyName);
        await io_utils.noThrow(io_requestable_resource.RequestableResource.deleteByName(api,
            requestable.resource_type, grantee, resource, policyName));
        //
        let r1 = await io_utils.noThrow(requestable.create(api));
        expect(r1.error).toBe(false);

        let r2 = await io_utils.noThrow(io_requestable_resource.RequestableResource.getByName(api,
            requestable.resource_type, grantee, resource, policyName));
        expect(r2.id).toBeDefined();

        await io_utils.noThrow(r2.delete(api));
        await io_utils.noThrow(policy.delete(api));
        await io_utils.ignoreError(new io_role.Role(endorsementRole).delete(api));
        let r = await io_utils.noThrow(io_secret.Secret.deleteByName(api, resource));
        expect(r.error).toBe(false);
    });


});

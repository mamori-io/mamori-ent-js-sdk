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
    let grantee = "test_apiuser_secret" + testbatch;
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

        let secretText = "#(*7322323!!!jnsas@^0001";
        let s = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, resourceName)
            .withSecret(secretText)
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

        //Export
        let kName = "test_secret_aes_" + testbatch;
        await helper.EncryptionKey.setupAESEncryptionKey(api, kName);
        let xx = await io_utils.noThrow(io_secret.Secret.exportByName(api, resourceName, kName));
        expect(xx.id).toBeDefined();
        await io_utils.noThrow(io_secret.Secret.deleteByName(api, resourceName));
        let xx1 = await io_utils.noThrow(xx.restoreWithKey(api, kName));
        expect(xx1.status).toBe('OK');
        //
        let x2 = await io_utils.noThrow(io_secret.Secret.getByName(api, resourceName));
        let x3 = await io_utils.noThrow(x2.grantTo(api, username));
        let x4 = await io_utils.noThrow(x2.reveal(api));
        expect(x4.secret).toBe(secretText);
        //
        await helper.EncryptionKey.cleanupAESEncryptionKey(api, kName);
        let r = await io_utils.noThrow(io_secret.Secret.deleteByName(api, resourceName));
        expect(r.error).toBe(false);
        let r4 = await io_utils.noThrow(io_secret.Secret.list(api, 0, 100, [["name", "=", resourceName]]));
        expect(r4.data.length).toBe(0);
    });

    test('secret requestable', async () => {
        let resource = "test_req_secret" + testbatch;
        await io_utils.noThrow(io_secret.Secret.deleteByName(api, resource));
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


    test('secret multi-part 01', async () => {
        //Clean up old data
        let part1 = 'TEST_secret_part1' + testbatch;
        let part2 = 'TEST_secret_part2' + testbatch;
        let multiSecret = 'TEST_secret_combined' + testbatch;

        await io_utils.noThrow(io_secret.Secret.deleteByName(api, part1));
        await io_utils.noThrow(io_secret.Secret.deleteByName(api, part2));
        await io_utils.noThrow(io_secret.Secret.deleteByName(api, multiSecret));

        let p1 = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, part1)
            .withSecret("11111")
            .withUsername("testUser")
            .withHost("10.123.0.100")
            .withDescription("The Desc");
        let r1 = await io_utils.noThrow(p1.create(api));
        expect(r1.status).toBe('OK');

        let p2 = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, part2)
            .withSecret("2222")
            .withUsername("testUser")
            .withHost("10.123.0.100")
            .withDescription("The Desc");
        let r2 = await io_utils.noThrow(p2.create(api));
        expect(r2.status).toBe('OK');

        let sec = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, multiSecret)
            .withType(io_secret.SECRET_TYPE.MULTI_SECRET)
            .withSecret([part1, part2]);
        let r3 = await io_utils.noThrow(sec.create(api));
        expect(r3.status).toBe('OK');

        let r4 = await io_utils.noThrow(io_secret.Secret.getByName(api, multiSecret));
        expect(r4.type).toBe(io_secret.SECRET_TYPE.MULTI_SECRET);

        await io_utils.noThrow(io_secret.Secret.deleteByName(api, part1));
        await io_utils.noThrow(io_secret.Secret.deleteByName(api, part2));
        await io_utils.noThrow(io_secret.Secret.deleteByName(api, multiSecret));
    });


});

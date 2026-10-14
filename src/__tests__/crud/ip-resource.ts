import {
    MamoriService,
    io_https, io_utils, io_ipresource, io_requestable_resource, io_role, io_tag
} from '../../api';
import * as helper from '../../__utility__/test-helper';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("IP resource CRUD tests", () => {

    let api: MamoriService;
    let resourceName: string = "testIPResource" + testbatch;
    let grantee = "test_apiuser_iprsc" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!3#$4#12_vdQ'}D";

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
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

    test('ip create 01', async () => {
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
    });


    test('ip resource requestable', async () => {
        let resource = "test.ip.rsc." + testbatch;
        let cidr = "10.0.200.0/24";
        let ports = "443,80";
        let r = new io_ipresource.IpResource(resource).withCIDR(cidr).withPorts(ports);
        await io_utils.ignoreError(r.delete(api));
        let r3 = await io_utils.noThrow(r.create(api));
        expect(r3).toSucceed();
        // ROLE
        let policyName = "test_auto_Resource_policy_" + testbatch;
        let endorsementRole = "test_role_for_" + policyName;
        let policy = await helper.Policy.setupResourcePolicy(api, endorsementRole, policyName);

        //REQUESTABLE
        let requestable = new io_requestable_resource.RequestableResource(io_requestable_resource.REQUEST_RESOURCE_TYPE.IP_RESOURCE)
            .withResource(resource)
            .withGrantee(grantee)
            .withPolicy(policyName);
        await io_utils.noThrow(io_requestable_resource.RequestableResource.deleteByName(api,
            requestable.resource_type, grantee, resource, policyName));
        //
        let r1 = await io_utils.noThrow(requestable.create(api));
        expect(r1).toSucceed();

        let r2 = await io_utils.noThrow(io_requestable_resource.RequestableResource.getByName(api,
            requestable.resource_type, grantee, resource, policyName));
        expect(r2.id).toBeDefined();

        await io_utils.noThrow(r2.delete(api));
        await io_utils.noThrow(policy.delete(api));
        await io_utils.ignoreError(new io_role.Role(endorsementRole).delete(api));
        await io_utils.ignoreError(r.delete(api));
        //
    });

    test('ip resource tags - add/remove and cascade on delete', async () => {
        const ipName = 'test_ip_tags_' + testbatch;
        const tagName = 'test_ip_tag_' + testbatch;
        const ip = new io_ipresource.IpResource(ipName)
            .withCIDR('10.0.201.0/24')
            .withPorts('443');
        await io_utils.ignoreError(ip.delete(api));
        const existingTag = await io_utils.ignoreError(io_tag.Tag.getByName(api, tagName));
        if (existingTag && existingTag.id) {
            await io_utils.ignoreError(existingTag.delete(api));
        }

        expect(await io_utils.noThrow(ip.create(api))).toSucceed();

        const tag = new io_tag.Tag(tagName);
        expect(await io_utils.noThrow(tag.create(api))).toSucceed();
        expect(tag.id).toBeTruthy();

        try {
            expect(await io_utils.noThrow(ip.addTag(api, tag))).toSucceed();

            let assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            let match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'ip' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === ipName.toLowerCase(),
            );
            expect(match.length).toBe(1);

            expect(await io_utils.noThrow(ip.removeTag(api, tag))).toSucceed();
            assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'ip' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === ipName.toLowerCase(),
            );
            expect(match.length).toBe(0);

            expect(await io_utils.noThrow(ip.addTag(api, tagName))).toSucceed();
            expect(await io_utils.noThrow(ip.delete(api))).toSucceed();

            assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'ip' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === ipName.toLowerCase(),
            );
            expect(match.length).toBe(0);
        } finally {
            await io_utils.ignoreError(ip.delete(api));
            await io_utils.ignoreError(tag.delete(api));
        }
    });

});

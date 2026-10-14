import { MamoriService } from '../../api';
import { io_https, io_utils, io_remotedesktop, io_requestable_resource, io_role, io_tag } from '../../api';
import * as helper from '../../__utility__/test-helper';
import '../../__utility__/jest/error_matcher';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

function fail(reason = "fail was called in a test.") {
    throw new Error(reason);
}

describe("remote desktop login tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_rmdlogin" + testbatch;
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

        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);
    });

    afterAll(async () => {
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    test('rmd-rdp login 01', async () => {
        let o = new io_remotedesktop.RemoteDesktopLogin("test_rdp_login" + testbatch, io_remotedesktop.REMOTE_DESKTOP_PROTOCOL.RDP);
        await io_utils.ignoreError(o.delete(api));
        o.at("host", "port").withLoginMode(io_remotedesktop.LOGIN_PROMPT_MODE.MAMORI_PROMPT);
        //verify to and from json
        let k = o.fromJSON(o.toJSON());
        let res = await io_utils.noThrow(k.create(api));
        expect(res).toSucceed();
        //Get Details Call
        let x = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.getByName(api, k.name));
        expect(x._id).toBeDefined();
        //let x2 = await noThrow(RemoteDesktopLogin.getByName(apiAsAPIUser, k.name));
        //expect(x2.errors).toBe(true);
        //List Call
        let x3 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(api, 0, 10, [["name", "=", k.name]]));
        expect(x3.data.length).toBe(1);
        let x4 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
        expect(x4.data.length).toBe(0);
        //Grant permission to user
        let x5 = await io_utils.noThrow(k.grantTo(api, grantee));
        expect(x5).toSucceed();
        //
        let x6 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
        expect(x6.data.length).toBe(1);
        //Ensure user can't delete a key
        let resDel2 = await io_utils.ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x7 = await io_utils.noThrow(k.revokeFrom(api, grantee));
        expect(x7).toSucceed();

        let x8 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
        expect(x8.data.length).toBe(0);

        //Delete
        let x9 = await io_utils.noThrow(k.delete(api));
        expect(x9).toSucceed();
        //
    });

    test('rmd-rdp login with .-', async () => {
        let o = new io_remotedesktop.RemoteDesktopLogin("test_rdp-.-" + testbatch, io_remotedesktop.REMOTE_DESKTOP_PROTOCOL.RDP);
        await io_utils.ignoreError(o.delete(api));
        o.at("host", "port").withLoginMode(io_remotedesktop.LOGIN_PROMPT_MODE.MAMORI_PROMPT);
        //verify to and from json
        let k = o.fromJSON(o.toJSON());
        let res = await io_utils.noThrow(k.create(api));
        expect(res).toSucceed();
        //Get Details Call
        let x = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.getByName(api, k.name));
        expect(x._id).toBeDefined();
        //let x2 = await noThrow(RemoteDesktopLogin.getByName(apiAsAPIUser, k.name));
        //expect(x2.errors).toBe(true);
        //List Call
        let x3 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(api, 0, 10, [["name", "=", k.name]]));
        expect(x3.data.length).toBe(1);
        let x4 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
        expect(x4.data.length).toBe(0);
        //Grant permission to user
        let x5 = await io_utils.noThrow(k.grantTo(api, grantee));
        expect(x5).toSucceed();
        //
        let x6 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
        expect(x6.data.length).toBe(1);
        //Ensure user can't delete a key
        let resDel2 = await io_utils.ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x7 = await io_utils.noThrow(k.revokeFrom(api, grantee));
        expect(x7).toSucceed();

        let x8 = await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
        expect(x8.data.length).toBe(0);

        //Delete
        let x9 = await io_utils.noThrow(k.delete(api));
        expect(x9).toSucceed();
        //
    });


    test('rmd-rdp requestable', async () => {
        let resource = "test_02_rdp_login" + testbatch;
        let o = new io_remotedesktop.RemoteDesktopLogin(resource, io_remotedesktop.REMOTE_DESKTOP_PROTOCOL.RDP);
        await io_utils.ignoreError(o.delete(api));
        o.at("host", "port").withLoginMode(io_remotedesktop.LOGIN_PROMPT_MODE.MAMORI_PROMPT);
        let res = await io_utils.noThrow(o.create(api));
        expect(res).toSucceed();
        // ROLE
        let policyName = "test_auto_rdp_Resource_policy_" + testbatch;
        let endorsementRole = "test_role_for_" + policyName;
        let policy = await helper.Policy.setupResourcePolicy(api, endorsementRole, policyName);

        //REQUESTABLE
        let requestable = new io_requestable_resource.RequestableResource(io_requestable_resource.REQUEST_RESOURCE_TYPE.REMOTE_DESKTOP)
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

        //Delete the rdp resource
        await io_utils.ignoreError(o.delete(api));
        //Check if requestable is also gone
        let r3 = await io_utils.noThrow(io_requestable_resource.RequestableResource.getByName(api,
            requestable.resource_type, grantee, resource, policyName));
        expect(r3).toBeNull();
        // delete requestable
        await io_utils.noThrow(r2.delete(api));
        // delete policy
        await io_utils.noThrow(policy.delete(api));
        // delete role
        await io_utils.ignoreError(new io_role.Role(endorsementRole).delete(api)); 
    });

    test('rmd-rdp tags - add/remove and cascade on delete', async () => {
        const rdpName = 'test_rdp_tags_' + testbatch;
        const tagName = 'test_rdp_tag_' + testbatch;
        const rdp = new io_remotedesktop.RemoteDesktopLogin(
            rdpName,
            io_remotedesktop.REMOTE_DESKTOP_PROTOCOL.RDP,
        );
        await io_utils.ignoreError(rdp.delete(api));
        const existingTag = await io_utils.ignoreError(io_tag.Tag.getByName(api, tagName));
        if (existingTag && existingTag.id) {
            await io_utils.ignoreError(existingTag.delete(api));
        }

        rdp.at('host', 'port').withLoginMode(io_remotedesktop.LOGIN_PROMPT_MODE.MAMORI_PROMPT);
        expect(await io_utils.noThrow(rdp.create(api))).toSucceed();

        const tag = new io_tag.Tag(tagName);
        expect(await io_utils.noThrow(tag.create(api))).toSucceed();
        expect(tag.id).toBeTruthy();

        try {
            expect(await io_utils.noThrow(rdp.addTag(api, tag))).toSucceed();

            let assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            let match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'rdp' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === rdpName.toLowerCase(),
            );
            expect(match.length).toBe(1);

            expect(await io_utils.noThrow(rdp.removeTag(api, tag))).toSucceed();
            assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'rdp' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === rdpName.toLowerCase(),
            );
            expect(match.length).toBe(0);

            expect(await io_utils.noThrow(rdp.addTag(api, tagName))).toSucceed();
            expect(await io_utils.noThrow(rdp.delete(api))).toSucceed();

            assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'rdp' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === rdpName.toLowerCase(),
            );
            expect(match.length).toBe(0);
        } finally {
            await io_utils.ignoreError(rdp.delete(api));
            await io_utils.ignoreError(tag.delete(api));
        }
    });

});

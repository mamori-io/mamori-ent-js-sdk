import { MamoriService, io_utils, io_https, io_requestable_resource, io_role, io_key } from '../../api';
import * as helper from '../../__utility__/test-helper';
import { SshLogin } from '../../ssh-login';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("ssh login tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_sshlogin" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!@34#12_vdQ'}D";
    let sshKeyName = "test_sshlogin_ssh_key" + testbatch;


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
        //Create the SSH KEY
        let x = await new io_key.Key(sshKeyName).ofType(io_key.KEY_TYPE.SSH).withAlgorithm(io_key.SSH_ALGORITHM.RSA).ofSize(1024).create(api);
        expect(x).toContain("ssh-rsa");


    });

    afterAll(async () => {
        await new io_key.Key(sshKeyName).delete(api);
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    test('ssh login 01', async () => {
        let k = new SshLogin("test_ssh_login_to_local" + testbatch);
        await io_utils.ignoreError(k.delete(api));
        //Create
        k.at("localhost", "22");
        k.withKeyCredentials("root", sshKeyName);

        k = k.fromJSON(k.toJSON())
        let res = await io_utils.noThrow(k.create(api));
        expect(res.status).toBe("ok");

        //Ensure item returned properly
        let x = (await io_utils.noThrow(SshLogin.getAll(api))).filter((o: any) => o.name == k.name)[0];
        expect(x.private_key_name).toBe(sshKeyName);

        //Ensure non-admins can't see any rows
        let x2 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x2.length).toBe(0);

        //Grant to User
        let x3 = await io_utils.noThrow(k.grantTo(api, grantee));
        expect(x3.errors).toBe(false);
        //Ensure user can see the object
        let x4 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDel2 = await io_utils.ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await io_utils.noThrow(k.revokeFrom(api, grantee));
        expect(x5.errors).toBe(false);
        //Ensure the key was revoked
        let x6 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await io_utils.noThrow(k.delete(api));
        expect(resDel.status).toBe("ok");

    });


    test('ssh login 02', async () => {
        let name = "test_ssh_pw_to_local" + testbatch
        let k = new SshLogin(name);
        await io_utils.ignoreError(k.delete(api));
        //Create
        k.at("localhost", "2200");
        k = k.fromJSON(k.toJSON())
        let res = await io_utils.noThrow(k.create(api));
        expect(res.status).toBe("ok");

        //Ensure item returned properly
        let x = (await io_utils.noThrow(SshLogin.getAll(api))).filter((o: any) => o.name == k.name)[0];
        expect(x.name).toBe(name);
        expect(x.login_mode).toBe("mamori");

        //Ensure non-admins can't see any rows
        let x2 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x2.length).toBe(0);

        //Grant to User
        let x3 = await io_utils.noThrow(k.grantTo(api, grantee));
        expect(x3.errors).toBe(false);
        //Ensure user can see the object
        let x4 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDel2 = await io_utils.ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await io_utils.noThrow(k.revokeFrom(api, grantee));
        expect(x5.errors).toBe(false);
        //Ensure the key was revoked
        let x6 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);


        let resDel = await io_utils.noThrow(k.delete(api));
        expect(resDel.status).toBe("ok");

    });

    test('ssh login 03', async () => {
        let name = "test_ssh_cred_to_local" + testbatch
        let k = new SshLogin(name);
        await io_utils.ignoreError(k.delete(api));
        //Create
        k.at("localhost", "22");
        k.withPasswordCredentials("testuser", "dummypw");
        k = k.fromJSON(k.toJSON())
        let res = await io_utils.noThrow(k.create(api));
        expect(res.status).toBe("ok");

        //Ensure item returned properly
        let x = (await io_utils.noThrow(SshLogin.getAll(api))).filter((o: any) => o.name == k.name)[0];
        expect(x.name).toBe(name);
        expect(x.login_mode).toBe("cred");

        //Ensure non-admins can't see any rows
        let x2 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x2.length).toBe(0);

        //Grant to User
        let x3 = await io_utils.noThrow(k.grantTo(api, grantee));
        expect(x3.errors).toBe(false);
        //Ensure user can see the object
        let x4 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDel2 = await io_utils.ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await io_utils.noThrow(k.revokeFrom(api, grantee));
        expect(x5.errors).toBe(false);
        //Ensure the key was revoked
        let x6 = (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);


        let resDel = await io_utils.noThrow(k.delete(api));
        expect(resDel.status).toBe("ok");

    });


    test('ssh requestable', async () => {
        let resource = "test_rdp_login" + testbatch;
        let k = new SshLogin(resource);
        k.at("localhost", "22");
        k.withPasswordCredentials("testuser", "dummypw");
        await io_utils.ignoreError(k.delete(api));
        let res = await io_utils.noThrow(k.create(api));
        expect(res.status).toBe("ok");

        // ROLE
        let policyName = "test_auto_ssh_policy_" + testbatch;
        let endorsementRole = "test_role_for_" + policyName;
        let policy = await helper.Policy.setupResourcePolicy(api, endorsementRole, policyName);

        //REQUESTABLE
        let requestable = new io_requestable_resource.RequestableResource(io_requestable_resource.REQUEST_RESOURCE_TYPE.SSH_LOGIN)
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
        await io_utils.ignoreError(k.delete(api));
        //
    });






});

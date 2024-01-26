import { MamoriService, io_utils } from '../../api';
import { io_https, io_user } from '../../api';
import { SshTunnel } from '../../network';

import { execute, sleep } from '../../__utility__/test-helper';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const vpn_ssh_user = process.env.MAMORI_SSH_VPN_USER || 'root';
const vpn_ssh_host = process.env.MAMORI_SSH_VPN_HOST || '';
let vpn_test = vpn_ssh_host ? test : test.skip;

describe("network ssh tunnel tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_sshtunnel" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!@34#12_vdQ'}D";
    let sshKeyName = "mamori_server_ssh_tunnel_test_key";

    /***********************
    For test to run
    1. create an ssh key called mamori_server_ssh_tunnel_test_key
    2. add the public key to authorized keys of the mamori server
    *************************/

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        let user = new io_user.User(grantee).withFullName(grantee).withEmail("test@test.com");
        await io_utils.ignoreError(user.delete(api));
        let r = await io_utils.noThrow(user.create(api, granteepw));

        apiAsAPIUser = new MamoriService(host, INSECURE);
        let r2 = await io_utils.noThrow(apiAsAPIUser.login(grantee, granteepw));
        expect(r2.username).toBe(grantee);
        expect(r2.login_token).toBeDefined();
    });

    afterAll(async () => {
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    vpn_test('ssh tunnel 01', async () => {
        let k = new SshTunnel("test_ssh_tunnel_to_local" + testbatch);
        k.at(vpn_ssh_host, 22);
        k.forward(2222, "localhost", 22);
        k.withCredentials(vpn_ssh_user, sshKeyName);
        await io_utils.ignoreError(k.delete(api));
        //Create
        let res = await io_utils.noThrow(k.create(api));
        expect(res).toBe("started");
        //Ensure item returned properly
        let x = (await io_utils.noThrow(SshTunnel.getAll(api))).filter((o: any) => o.name == k.name)[0];
        expect(x.type).toBe("ssh");

	await sleep(2000);

	let stdout = await execute('ssh -p 2222 ' + vpn_ssh_user + "@localhost -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C \"echo 'SVQgTElWRVMK' | base64 -d\"");

	expect(stdout.trim()).toBe("IT LIVES");


        let resDel = await io_utils.noThrow(k.delete(api));
        expect(resDel).toBe("ok");

        //expect(x.private_key_name).toBe(sshKeyName);
        /*
        //Ensure non-admins can't see any rows
        let x2 = (await noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x2.length).toBe(0);
        //Grant to User
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3.errors).toBe(false);
        //Ensure user can see the object
        let x4 = (await noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDel2 = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5.errors).toBe(false);
        //Ensure the key was revoked
        let x6 = (await noThrow(SshLogin.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        */
    });




    vpn_test('ssh tunnel 02', async () => {
        let k = new SshTunnel("te-st_ssh_tunnel_to_local" + testbatch);
        k.at(vpn_ssh_host, 22);
        k.forward(2222, "localhost", 22);
        k.withCredentials(vpn_ssh_user, sshKeyName);
        await io_utils.ignoreError(k.delete(api));
        //Create
        let res = await io_utils.noThrow(k.create(api));
        expect(res).toBe("started");
        //Ensure item returned properly
        let x = (await io_utils.noThrow(SshTunnel.getAll(api))).filter((o: any) => o.name == k.name)[0];
        expect(x.type).toBe("ssh");

	await sleep(2000);

	let stdout = await execute('ssh -p 2222 ' + vpn_ssh_user + "@localhost -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C \"echo 'SVQgTElWRVMK' | base64 -d\"");

	expect(stdout.trim()).toBe("IT LIVES");


        let resDel = await io_utils.noThrow(k.delete(api));
        expect(resDel).toBe("ok");

        //expect(x.private_key_name).toBe(sshKeyName);
        /*
        //Ensure non-admins can't see any rows
        let x2 = (await noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x2.length).toBe(0);
        //Grant to User
        let x3 = await noThrow(k.grantTo(api, grantee));
        expect(x3.errors).toBe(false);
        //Ensure user can see the object
        let x4 = (await noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == k.name);
        expect(x4.length).toBe(1);

        //Ensure user can't delete a key
        let resDel2 = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5.errors).toBe(false);
        //Ensure the key was revoked
        let x6 = (await noThrow(SshLogin.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        */
    });




});

import { MamoriService } from '../api';
import * as https from 'https';
import { Key, KEY_TYPE, SSH_ALGORITHM } from '../key';
import { SshTunnel } from '../network';
import { handleAPIException, noThrow, ignoreError } from '../utils';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("network ssh tunnel tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_apiuser_sshtunnel";
    let granteepw = "J{J'vpKs!$nW6(6A,4!@34#12_vdQ'}D";
    let sshKeyName = "test_sshtunnel_ssh_key";

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        await ignoreError(api.delete_user(grantee));
        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        })

        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);
        //Create the SSH KEY
        let x = await new Key(sshKeyName).ofType(KEY_TYPE.SSH).withAlgorithm(SSH_ALGORITHM.RSA).ofSize(1024).create(api);
        expect(x).toContain("ssh-rsa");


    });

    afterAll(async () => {
        await new Key(sshKeyName).delete(api);
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    test.skip('ssh tunnel 01', async done => {
        let k = new SshTunnel("test_ssh_tunnel_to_local");
        /*
        let k = new SshLogin("test_ssh_login_to_local");
        await ignoreError(k.delete(api));
        //Create
        k.at("localhost", "22");
        k.withCredentials("root", sshKeyName);
        let res = await noThrow(k.create(api));
        expect(res.status).toBe("ok");

        //Ensure item returned properly
        let x = (await noThrow(SshLogin.getAll(api))).filter((o: any) => o.name == k.name)[0];
        expect(x.private_key_name).toBe(sshKeyName);

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
        expect(resDel2.response.status).toBe(500);

        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5.errors).toBe(false);
        //Ensure the key was revoked
        let x6 = (await noThrow(SshLogin.getAll(apiAsAPIUser))).filter((key: any) => key.name == k.name);
        expect(x6.length).toBe(0);

        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel.status).toBe("ok");
        */
        done();
    });


});

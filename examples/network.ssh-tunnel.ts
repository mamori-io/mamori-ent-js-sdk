process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { MamoriService,io_https, io_utils, SshTunnel} from 'mamori-ent-js-sdk';
import { execute, sleep } from 'mamori-ent-js-sdk';

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
const vpn_ssh_host = process.env.MAMORI_SSH_VPN_HOST || '';
const vpn_ssh_user = process.env.MAMORI_SSH_VPN_USER || 'root';  

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;
  
async function example() {
    let api = new MamoriService(mamoriUrl);
		console.info("Connecting...");
	  let login = await api.login(mamoriUser, mamoriPwd);
	  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
    let sshKeyName = "mamori_server_ssh_tunnel_test_key";
    ///////////////
    //CONFIGURE IT
    let name : string = "example_network_ssh_tunnel";
    let s = new SshTunnel("example_ssh_tunnel_to_local");
    s.at(vpn_ssh_host, 22);
    s.forward(2222, "localhost", 22);
    s.withCredentials(vpn_ssh_user, sshKeyName);
    await io_utils.ignoreError(s.delete(api));

    /////////////
    // CREATE IT
    await io_utils.noThrow(s.create(api));
    console.info("creating network.ssh_t...%s", name);
    ///////////
    //READ IT
    await sleep(2000);
    
    await execute('ssh -p 2222 ' + vpn_ssh_user + "@localhost -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C \"echo 'SVQgTElWRVMK' | base64 -d\"");
    (await io_utils.noThrow(SshTunnel.getAll(api))).filter((o: any) => o.name == s.name)[0];
    console.info("reading network.ssh_t...%s", name);
    ///////////
    //DELETE IT
    await io_utils.noThrow(new SshTunnel(name).delete(api));
    console.info("deleting network.ssh_t...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

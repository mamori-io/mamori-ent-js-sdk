process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils, io_ipresource} from '../src/api';

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {
	let api = new MamoriService(mamoriUrl);
	console.info("Connecting...");
	let login = await api.login(mamoriUser, mamoriPwd);
	console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);		
	///////////////
	//CONFIGURE IT
	let name: string = "example_ip_r_";
	let cidr = "10.0.200.0/24";
	let ports = "443,80";
	let i = new io_ipresource.IpResource(name).withCIDR(cidr).withPorts(ports);
    /////////////
	//CREATE IT
	await io_utils.noThrow(i.create(api));
	console.info("creating ip_resource...%s", name);
	///////////
	//READ IT
	await io_utils.noThrow(io_ipresource.IpResource.list(api, 0, 100, [["name", "=", name]])); 
	console.info("reading ip_resource...%s", name);
	///////////
	//DELETE IT
	await io_utils.noThrow(i.delete(api))
	console.info("deleting ip_resource...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

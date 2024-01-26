process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from '../src/api';
import { io_policy, io_alertchannel, io_role, io_permission, io_user } from "../src/api";


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
	  	console.info("creating connection policy...");
	  	
}

example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

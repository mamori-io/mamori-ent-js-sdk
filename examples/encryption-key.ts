process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_key,io_utils } from '../src/api';
import { io_role, io_permission } from "../src/api";


const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const host = process.env.MAMORI_SERVER || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {
	 	let api = new MamoriService(mamoriUrl);
		console.info("Connecting...");
	  	let login = await api.login(mamoriUser, mamoriPwd);

	  	console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
	
		//CREATE ROLE TO BE GRANTEE GRANTEE
		let grantee = "example_Role_key";
		let role = new io_role.Role(grantee);
		await io_utils.noThrow(role.create(api));

		//////////////
		//CONFIGURE IT
		let name = "example_rsa_key";
		let k = new io_key.Key(name);
		k.ofType(io_key.KEY_TYPE.AES);
        
		//Create
        await io_utils.noThrow(k.create(api));
        console.info("creating key...%s", name);

		////////////
		//READ IT
		let x = (await io_utils.noThrow(io_key.Key.getAll(api))).find((key: any) => key.name == k.name);
        console.info("reading key...%s %o", name,x);
		///////////
		// GRANT IT
		await io_utils.noThrow(k.grantTo(api, grantee)); 
		console.info("granting key...%s", name);
		//////////
		//DELETE IT
		await io_utils.ignoreError(k.delete(api));
		console.info("deleting key...%s", name);


		
}

example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

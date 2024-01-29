process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils, io_http_resource} from '../src/api';


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
let name: string = "example_http_r_";
let s = new io_http_resource.HTTPResource(name)
            .withURL("https://localhost/minotor")
            .withDescription("Created by Automated Test")
            .withExcludeFromPAC(false);


/////////////
// CREATE IT
await io_utils.noThrow(s.create(api));
console.info("creating http_r...%s", name);

///////////
//READ IT
// await io_utils.noThrow(io_http_resource.HTTPResource.getByName(api, resourceName));
await io_utils.noThrow(io_http_resource.HTTPResource.getByName(api, name));
console.info("reading http_r...%s", name);

///////////
//DELETE IT
//await io_utils.noThrow(new io_http_resource.HTTPResource(resourceName).delete(api));
await io_utils.noThrow(new io_http_resource.HTTPResource(name).delete(api));
console.info("deleting http_r...%s", name);
}



example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService, io_https, io_utils, io_secret, io_requestable_resource, io_role, io_user } from '../src/api';

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
    let resourceName: string = "example_Secret_aa_";

    ///////////////
    //CONFIGURE IT
    let name: string = "";
    let secretText = "#(*7322323!!!jnsas@^0001";
    let s = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, resourceName)
        .withSecret(secretText)
        .withUsername("testUser")
        .withHost("10.123.0.100")
        .withDescription("The Desc");
    let s0 = io_secret.Secret.build(s.toJSON());

    /////////////  
    // CREATE IT
    await io_utils.noThrow(s0.create(api));
    console.info("creating secret...%s", name);
    
    ///////////
    //READ IT
    await io_utils.noThrow(io_secret.Secret.list(api, 0, 100, [["name", "=", resourceName]]));
    let w = await io_utils.noThrow(io_secret.Secret.getByName(api, resourceName));
    if (w) {
        let w1 = (w as io_secret.Secret).withHost("100.100.100.100").withDescription("NewDesc");
        await io_utils.noThrow(w1.update(api));
        let w3 = (await io_utils.noThrow(io_secret.Secret.getByName(api, resourceName)) as io_secret.Secret);
        expect(w3.description).toBe("NewDesc");
        expect(w3.hostname).toBe("100.100.100.100");
        }
    console.info("reading secret...%s", name);

    ///////////
    //DELETE IT
    await io_utils.noThrow(s.delete(api));
    console.info("deleting secret...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

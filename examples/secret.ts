process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { MamoriService, io_https, io_utils, io_secret } from 'mamori-ent-js-sdk';

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
    let secretText = "#(*7322323!!!jnsas@^0001";
    let s = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, resourceName)
        .withSecret(secretText)
        .withUsername("testUser")
        .withHost("10.123.0.100")
        .withDescription("The Desc");
    /////////////  
    // CREATE IT    
    await io_utils.noThrow(s.create(api));
    console.info("creating secret...%s", resourceName);
    
    ///////////
    //READ IT
    await io_utils.noThrow(io_secret.Secret.list(api, 0, 100, [["name", "=", resourceName]]));
    let w = await io_utils.noThrow(io_secret.Secret.getByName(api, resourceName));
    console.info("reading secret...%s", w);

    ///////////
    //DELETE IT
    await io_utils.noThrow(io_secret.Secret.deleteByName(api,resourceName));
    console.info("deleting secret...%s", resourceName);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

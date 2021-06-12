// allow for self-signed certificates
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { DMService } from '../src/api';

let mamoriUrl  = "https://localhost:8443/" ;
let mamoriUser = "alice" ;
let mamoriPwd  = "mirror" ;

let dm = new DMService(mamoriUrl);

async function display_systems() {
  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  console.info("Fetching user systems...");
  let systems = await dm.user_systems();
  console.info("User systems: ", systems);
}

display_systems().catch(e => console.error("ERROR:", e)).finally(() => process.exit(0));

import { DMService } from '../src/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2)) ;
argv.url = argv.url || 'localhost:443';
console.log(argv);

const INSECURE = new https.Agent({rejectUnauthorized: false});
let dm = new DMService("https://" + argv.url + "/", INSECURE);

async function display_systems() {
  console.info("Server status: ", await dm.service_status());

  console.info("Connecting...");
  let login = await dm.login(argv._[0], argv._[1]);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  console.info("Fetching user systems...");
  let systems = await dm.user_systems();
  console.info("Systems: ", systems);
}

display_systems().catch(e => console.error("ERROR: ", e)).finally(() => process.exit(0));

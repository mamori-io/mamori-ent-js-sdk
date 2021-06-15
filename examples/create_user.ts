import { DMService } from '../dist/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2)) ;
argv.url = argv.url || 'localhost:443';
console.log(argv);

const INSECURE = new https.Agent({ rejectUnauthorized: false });
let dm = new DMService("https://" + argv.url + "/", INSECURE);

async function create_user() {
  console.info("Connecting...");
  let login = await dm.login(argv._[0], argv._[1]);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  try {
    let duser = await dm.delete_user("test_user");
    console.info("Delete user: ", duser);
  }
  catch (e) {
    console.info("Delete user: ", (e as Error).message);
  }

  console.info("Creating test user...");
  let cuser = await dm.create_user({
    username: "test_user",
    password: "test",
    fullname: "Test User",
    identified_by: "password",
    authenticated_by_primary: {provider: "totp"},
    email: "test@test.test",
    valid_from: "2021-06-10 09:00:00",
    valid_until: "2021-06-31 17:00:00",
    valid_timezone: "Australia/Melbourne"
  });
  console.info("User: ", cuser);

  let grant = await dm.grant_role_to_grantee("secure_connect", "test_user");
  console.info("Grant: ", grant);

  await dm.logout() ;
}

create_user().catch(e => console.error("ERROR: ", e)).finally(() => process.exit(0));

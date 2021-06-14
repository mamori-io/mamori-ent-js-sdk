import { DMService } from '../src/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2));
argv.url = argv.url || 'localhost:443';
console.log(argv);
let mamoriUser = argv._[0];
let mamoriPwd = argv._[1];

let mgrRoleName = "data_manager";
let userRoleName = "data_user";
let revealRoleName = "data_reveal";

const INSECURE = new https.Agent({ rejectUnauthorized: false });
let dm = new DMService("https://" + argv.url + "/", INSECURE);

async function create_filter() {
  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  // Roles
  //
  var mgrRole = await dm.role(mgrRoleName);
  if (mgrRole) {
    console.info("mgrRole: ", mgrRoleName);
  }
  else {
    mgrRole = await dm.create_role({ roleid: mgrRoleName });
    console.info("Created role: ", mgrRoleName);
  }

  var userRole = await dm.role(userRoleName);
  if (userRole) {
    console.info("userRole: ", userRoleName);
  }
  else {
    userRole = await dm.create_role({ roleid: userRoleName });
    console.info("Created role: ", userRoleName);
  }

  var revealRole = await dm.role(revealRoleName);
  if (revealRole) {
    console.info("revealRole: ", revealRoleName);
  }
  else {
    revealRole = await dm.create_role({ roleid: revealRoleName });
    console.info("Created role: ", revealRoleName);
  }

  //  https://world.openfoodfacts.org/
  //
  var offResult = await dm.get_http_apifilters({ filter: ["name", "=", "openfoodfacts"] });
  if (offResult.data) {
    for(var i in offResult.data) {
      if ("openfoodfacts" == offResult.data[i].name) {
        console.info("openfoodfacts Filter: ", offResult.data[i]);
        await dm.delete_http_apifilter(offResult.data[i].id);
      }
    }
  }

  var offFilter = await dm.add_http_apifilter({
    name: "openfoodfacts",
    system: "openfoodfacts",
    type: "api",
    path: "/api/v0/product/737628064502.json",
    method: "GET",
    queryparameters: "",
    headers: "",
    body: "",
    owner: mamoriUser,
    transformations: '[{"name": "default","priority": 1,"elementSpec": "$..sugars","function": "MASK FULL"}]'
  });
  console.info("openfoodfacts Filter: ", offFilter);
  
  var offResult = await dm.get_http_apifilters({ filter: ["name", "=", "openfoodfacts"] });
  if (offResult.data) {
    for(var i in offResult.data) {
      if ("openfoodfacts" == offResult.data[i].name) {
        console.info("openfoodfacts Filter: ", offResult.data[i]);
        await dm.activate_http_apifilter(offResult.data[i].id);
      }
    }
  }

  await dm.logout();
}
create_filter().catch(e => console.error("ERROR: ", e.response.data)).finally(() => process.exit(0));

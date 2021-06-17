import { DMService } from '../dist/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2));
argv.url = argv.url || 'localhost:443';
let mamoriUser = argv._[0];
let mamoriPwd = argv._[1];

let mgrRoleName = "qlik_manager";
let userRoleName = "qlik_user";
let endorseRoleName = "qlik_endorser";
let filterName = "qlik_customers";
let accessName = "qlik_access";

const INSECURE = new https.Agent({ rejectUnauthorized: false });
let dm = new DMService("https://" + argv.url + "/", INSECURE);

async function setup_qlik_demo() {
  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  //
  // Qlik roles
  //
  var mgrRole = await dm.role(mgrRoleName);
  if (mgrRole) {
    console.info("Manager role: ", mgrRoleName);
  }
  else {
    mgrRole = await dm.create_role({ roleid: mgrRoleName });
    console.info("Created role: ", mgrRoleName);
  }

  var userRole = await dm.role(userRoleName);
  if (userRole) {
    console.info("User role: ", userRoleName);
  }
  else {
    userRole = await dm.create_role({ roleid: userRoleName });
    console.info("Created role: ", userRoleName);
  }

  var endorseRole = await dm.role(endorseRoleName);
  if (endorseRole) {
    console.info("Endorser role: ", endorseRoleName);
  }
  else {
    endorseRole = await dm.create_role({ roleid: endorseRoleName });
    console.info("Created role: ", endorseRoleName);
    let gp = await dm.grant_to(endorseRoleName, ['REQUEST'], "*", false) ;
    console.info("Created role: ", gp);
  }

  //
  //  Qliksense filter
  //

  // Teardown existing
  //
  var filterResult = await dm.get_http_apifilters([["name", "=", filterName]]);
  if (filterResult.data && filterResult.data.length > 0) {
    await dm.delete_http_apifilter(filterResult.data[0].id);
    console.info("Deleted filter: ", filterName);
  }
  await dm.policies_drop_procedure(accessName);
  console.info("Deleted procedure: ", accessName);

  // Setup anew
  //
  await dm.add_http_apifilter({
    name: filterName,
    system: "qlik",
    type: "qlik",
    path: "Customer Detail",
    method: "",
    queryparameters: "",
    headers: "",
    body: "",
    owner: mamoriUser,
    transformations: 
      '[{"name":"default","priority":1,"function":"MASK HASH","elementSpec":"Customer Name","functionArgs":"MD5"},' +
      '{"name":"default","priority":1,"function":"MASK FULL","elementSpec":"Customer Gender"},' +
      '{"name":"default","priority":1,"function":"MASK FULL","elementSpec":"Sales Revenue (Current Year)","functionArgs":"9|$,"},' +
      '{"name":"qlik_manager","priority":1,"function":"REVEAL","elementSpec":"*"}]',
  });
  console.info("Created Qlik filter: ", filterName);

  await dm.policies_create_procedure(accessName,
    {a: {name: "time", description: "Duration of access", default_value: "30"}},
    endorseRoleName,
    "policy",
    "Grant access to Qlik data",
    userRoleName,
    "",
    "",
    "",
    "",
    "1",
    "",
    "true",
    "",
    "BEGIN; GRANT " + mgrRoleName + " TO :applicant VALID FOR :time seconds; END");
  console.info("Created access policy: ", accessName);

  var filterResult = await dm.get_http_apifilters({ filter: ["name", "=", filterName] });
  if (filterResult) {
    await dm.activate_http_apifilter(filterResult.data[0].id);
    console.info("Activeted filter: ", filterName);
  }

  await dm.logout();
}

setup_qlik_demo().catch(e => console.error("ERROR: ", e.response.data)).finally(() => process.exit(0));

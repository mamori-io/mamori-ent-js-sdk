import { DMService } from '../dist/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2));
let url = argv.url || 'localhost:443';
let mamoriUser = argv._[0];
let mamoriPwd = argv._[1];
let accessName = argv._[2] || "qlik_access";

const INSECURE = new https.Agent({ rejectUnauthorized: false });
let dm = new DMService("https://" + url + "/", INSECURE);

async function request_access() {
  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  // Request procedure metadata
  //
  let po = await dm.policies_get_procedure_options(accessName) ;
  let optionsMap = {}; 
  po.forEach(option => optionsMap[option.name] = option.value);
  console.info("Request to: ", optionsMap["description"]);

  // Request arguments
  //
  let pp = await dm.policies_get_procedure_parameters(accessName) ;
  let pa = new Map(); 
  for(var i = 0; i < pp.length; i++) {   
    let p = pp[i] ;
    pa.set(p.id,  {name: p.name, value: argv[p.name] || p.default_value}) ;
  }  

  let requestMessage = argv._[3] || optionsMap["request_default_message "] || "" ;
  let o = await dm.policies_request_execute(accessName, Object.fromEntries(pa), requestMessage);
  console.info("Requested filter: ", accessName, " - ", o.request_key);

  await dm.logout();
}

request_access().catch(e => console.error("ERROR: ", e.response.data)).finally(() => process.exit(0));

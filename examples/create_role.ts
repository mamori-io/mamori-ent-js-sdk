import { DMService } from '../src/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2)) ;
argv.url = argv.url || 'localhost:443';
console.log(argv);
let mamoriUser = argv._[0] ;
let mamoriPwd  = argv._[1] ;

let roleId = "test_role" ;

const INSECURE = new https.Agent({ rejectUnauthorized: false });
let dm = new DMService("https://" + argv.url + "/", INSECURE);

async function create_role() {
  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  try {
    // Revoke from any users
    let grantees = await dm.search_users_with_role(roleId, {"assignedonly": "Y"}) ;
    for(var i in grantees.data) {
      await dm.revoke_role_from_grantee(roleId, grantees.data[i].username) ;
      console.info("Revoked: ", roleId, " from: ", grantees.data[i].username);
    }
    
    // Revoke from any roles
    await dm.revoke_role_from_grantee(roleId, "secure_connect") ;
    console.info("Revoked: ", roleId, " from: ", "secure_connect");

    await dm.delete_role(roleId);
    console.info("Delete role: ", roleId);
  }
  catch (e) {
    console.info("Delete role: ", (e as Error).message);
    throw e ;
  }

  console.info("Creating role: ", roleId);
  await dm.create_role({roleid: roleId, externalname: "Test role"});
  await dm.grant_role_to_grantee(roleId, mamoriUser);
  await dm.grant_role_to_grantee(roleId, "secure_connect");
  
  let grantedRoles = await dm.get_grantee_roles(roleId) ;
  console.info(roleId, " granted roles: ", grantedRoles);

  let grantees = await dm.search_users_with_role(roleId, {"assignedonly": "Y"}) ;
  var grantedTo:string[] = [] ;
  for(var i in grantees.data) {
    grantedTo.push(grantees.data[i].username) ;
  }
  console.info(roleId, " granted to: ", grantedTo);

  let roles = await dm.user_roles(mamoriUser) ;
  console.info(mamoriUser, " Roles: ", roles);

  await dm.logout() ;
}

create_role().catch(e => console.error("ERROR: ", e.response.data)).finally(() => process.exit(0));

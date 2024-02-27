process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils, io_user, io_ondemandpolicies, io_alertchannel, io_role, io_permission } from '../src/api';

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
    let requestAlert = new io_alertchannel.AlertChannel("example_policy_request_alert");
    let endorseAlert = new io_alertchannel.AlertChannel("example_policy_endorse_alert");

    ///////////////
    //CONFIGURE IT
    let name: string = "example_auto_policy_";
    let d = new io_ondemandpolicies.OnDemandPolicy(name);


    /////////////////////////
    // CREATE ROLE TO GRANTEE
    let grantee = "example_role";
    let requestRole = "test_policy_user_role";
    let agentRole = "test_policy_agent_role
    await io_utils.ignoreError(new io_role.Role(agentRole).create(api));
    await io_utils.ignoreError(new io_role.Role(requestRole).create(api));


    /////////////   
    // CREATE IT
    
    console.info("creating...%s", name);
    ///////////
    //READ IT

    console.info("reading...%s", name);
    ///////////
    //GRANT IT
    await io_utils.ignoreError(new io_permission.MamoriPermission([io_permission.MAMORI_PERMISSION.REQUEST]).grantee(requestRole).grant(api));
    await io_utils.ignoreError(new io_role.Role(agentRole).grantTo(api, agent, false));
    await io_utils.ignoreError(new io_role.Role(requestRole).grantTo(api, grantee, false));
    ///////////
    //DELETE IT
    
    console.info("deleting ...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

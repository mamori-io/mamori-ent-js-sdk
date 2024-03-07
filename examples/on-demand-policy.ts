process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils, io_user, io_ondemandpolicies, io_alertchannel, io_role, io_permission, SshTunnel } from '../src/api';

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


    /////////////////////////
    // CREATE ROLE TO GRANTEE
    let grantee = "example_role";
    let requestRole = "example_policy_user_role";
    let agentRole = "example_policy_agent_role";
    let agent = "example_o_d_policy_agent.";

    await io_utils.ignoreError(new io_role.Role(agentRole).create(api));
    await io_utils.ignoreError(new io_role.Role(requestRole).create(api));

    ///////////////
    //CONFIGURE IT
    let name: string = "example_auto_policy_";
    let o = new io_ondemandpolicies.OnDemandPolicy(name);
    o.request_role = requestRole;
    o.requires = agentRole;
    o.request_alert = requestAlert.name;
    o.endorse_alert = endorseAlert.name;
    o.addParameter("time", "number of minutes", "15");
    o.withScript(["GRANT SELECT ON * TO :APPLICANT VALID FOR :time minutes"]);

    /////////////   
    // CREATE IT
    await io_utils.noThrow(o.create(api));
    console.info("creating on_demand_policy...%s", name);
    ///////////
    //READ IT
    await io_utils.ignoreError(io_ondemandpolicies.OnDemandPolicy.get(api, name));
    console.info("reading on_demand_policy...%s", name);
    ///////////
    //GRANT IT
    await io_utils.ignoreError(new io_permission.MamoriPermission([io_permission.MAMORI_PERMISSION.REQUEST]).grantee(requestRole).grant(api));
    await io_utils.ignoreError(new io_role.Role(agentRole).grantTo(api, agent, false));
    await io_utils.ignoreError(new io_role.Role(requestRole).grantTo(api, grantee, false));
    ///////////
    //DELETE IT
    await io_utils.noThrow(io_ondemandpolicies.OnDemandPolicy.get(api, name))
    console.info("deleting on_demand_policy...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from '../src/api';
import { io_policy, io_alertchannel, io_role, io_permission, io_user } from "../src/api";


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
	  	

		///////////////////
		// For details on creating alerts see alert example.
		let requestAlert = new io_alertchannel.AlertChannel("examplealert_for_examplepolicy");
		requestAlert.addEmailAlert("omasri@mamori.io,test@mamori.io", "request alert", "REQUEST BODY");
        let r = await io_utils.noThrow(requestAlert.create(api));
        if (r && r.id) {
            requestAlert.id = r.id;
        }
		///////////////////
		//CONFIGURE OBJECT
		let name = "exampleconnectionpolicy" ;
		let policy = new io_policy.ConnectionPolicy(io_policy.POLICY_TYPES.BEFORE_CONNECTION, name);
        policy.withEnabled(false)
            .withPosition(20)
            .withEnabled(false)
            .withAction(io_policy.POLICY_ACTIONS.ALLOW)
            .withRuleType(io_policy.POLICY_RULE_TYPE.WHEN)
            .withRuleSEXP("(SOURCE-IP 127.0.0.1)")
            .withAlert(requestAlert.name);
        ////////////
		//CREATE IT
		await io_utils.noThrow(policy.create(api));
		console.info("creating alert channel...%s",name);
		////////////
		//READ IT
		let x2 = await io_utils.noThrow(io_policy.ConnectionPolicy.listBefore(api, { description: name }));		
		console.info("reading alert channel...%o",x2);
		////////////
		//DELETE IT
		
		console.info("deleting alert channel...%o",name);
	  	
}

example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

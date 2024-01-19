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

	  	console.info("creating connection policy...");
	  	let name = "c-policy" ;
		let cleanit = await io_utils.noThrow(io_alertchannel.AlertChannel.get(api, name));
		if (cleanit.length > 0) {
            let p2 = io_policy.ConnectionPolicy.build(cleanit[0]);
            await io_utils.noThrow(p2.delete(api));
        }

		//Delete old one
		let p2 = await io_utils.noThrow(io_alertchannel.AlertChannel.get(api, name));
		if (p2) {
			await io_utils.ignoreError(p2.delete(api));
		}

		//Set config for new one
		let policy = new io_policy.ConnectionPolicy(io_policy.POLICY_TYPES.BEFORE_CONNECTION, name);
        policy.withEnabled(false)
            .withPosition(20)
            .withEnabled(false)
            .withAction(io_policy.POLICY_ACTIONS.ALLOW)
            .withRuleType(io_policy.POLICY_RULE_TYPE.WHEN)
            .withRuleSEXP("(SOURCE-IP 127.0.0.1)")
            .withAlert(requestAlert.name);

	  
	  k.addHTTPAlert(io_alertchannel.HTTP_OPERATION.POST
		, ""
		, "https://hooks.slack.com/services/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"
		, JSON.stringify(body)
		, "application/json")
	 
	  k.addPushNotificationAlert("{{applicant}}", "Test Message");
	  let r = await io_utils.noThrow(k.create(api));

	  console.log("**** %o",r);
	  api.logout();
}

example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

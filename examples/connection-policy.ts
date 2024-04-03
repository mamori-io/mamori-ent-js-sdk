process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
import { MamoriService,io_https, io_utils } from 'mamori-ent-js-sdk';
import { io_policy, io_alertchannel, io_role, io_permission, io_user } from 'mamori-ent-js-sdk';


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
	console.info("creating connection policy...%s",name);
	////////////
	//READ IT		
	let listResults = (await io_utils.noThrow(io_policy.ConnectionPolicy.listBefore(api, { description: name })))[0];		
	console.info("reading  connection policy...%s",name);
	let policyObject = io_policy.ConnectionPolicy.build(listResults);
	////////////
	//DELETE IT
	await  io_utils.ignoreError(io_utils.noThrow(policyObject.delete(api)));
	console.info("deleting connection policy...%o",name);
	//
	api.logout();
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { AlertChannel, HTTP_OPERATION} from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from '../src/api';
import { io_alertchannel } from "../src/api";


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

	  	console.info("creating alert channel...");
	  	let name = "SOMENAME" ;
		let k = new io_alertchannel.AlertChannel(name);
		//Delete old one
		let r2 = await io_utils.noThrow(io_alertchannel.AlertChannel.get(api, name));
		if (r2) {
			await io_utils.ignoreError(r2.delete(api));
		}
		//Set config for new one
	  	k.addEmailAlert("omasri@mamori.io", "test subject", "My Message");
	  	let body = {
		  "attachments": [
			  {
				  "color": "#f93836",
				  "pretext": "A wireguard peer has been blocked",
				  "author_name": "Mamori",
				  "title": "Wireguard peer blocked - {{device}}",
				  "text": "User: {{username}} - client ip: {{source}}",
				  "footer": "This is a Mamori Peer Notification",
			  }
		  ]
	  };
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

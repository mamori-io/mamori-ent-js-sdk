/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { DMService } from '../../dist/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2));
argv.url = argv.url || 'localhost:443';
let mamoriUser = argv._[0];
let mamoriPwd = argv._[1];
let requestKey = argv._[2] ;

const INSECURE = new https.Agent({ rejectUnauthorized: false });
let dm = new DMService("https://" + argv.url + "/", INSECURE);

async function endorse_access() {
  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  let pp = await dm.policies_get_request_parameters(requestKey) ;
  console.info("Request parameters: ", pp);

  let ro = await dm.policies_request_action('ENDORSE', requestKey, argv._[3] || "")
  console.info("Endorsed request: ", requestKey, " - ", ro);

  await dm.logout();
}

endorse_access().catch(e => console.error("ERROR: ", e.response.data)).finally(() => process.exit(0));

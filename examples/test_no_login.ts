/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { DMService } from '../dist/api';

// allow for self signed certs
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

let argv = require('minimist')(process.argv.slice(2)) ;
argv.url = argv.url || 'localhost:443';

let dm = new DMService("https://" + argv.url + "/");

async function no_login() {
  console.info("server status:", await dm.service_status());
  console.info("Server time: ", await dm.server_time());
}

no_login().catch(e => console.error("ERROR: ", e)).finally(() => process.exit(0));

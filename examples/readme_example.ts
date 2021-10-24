/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */

// allow for self-signed certificates
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { DMService } from '../dist/api';
import { Datasource } from '../dist/datasource';

let mamoriUrl  = "https://localhost:443/" ;
let mamoriUser = "alice" ;
let mamoriPwd  = "mirror" ;

async function display_systems() {
  let dm = new DMService(mamoriUrl);

  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  console.info("Fetching user systems...");
  let systems = await Datasource.getAll(dm);
  console.info("User systems: ", systems);
}

display_systems()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

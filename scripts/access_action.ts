/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { Runnable } from '../dist/runnable' ;
import { DMService } from '../dist/api';
import { ParsedArgs } from 'minimist';

let usage = 
"Usage:\n" + 
"   yarn ts-node scripts/access_action.ts [--help] --url <url> <user> <action> <requestKey> [<message>]\n" + 
"where:\n" + 
"   url         Default: localhost:443\n" +
"   user        mamori user\n" +
"   password\n" +
"   action      CANCEL, DENY, ENDORSE or EXECUTE\n" +
"   requestKey  Identifying request key, e.g. 4b9383f4-017a-e5f1-40b9-00001660cb1e, output by access_request.ts\n" +
"   message     Execution message" ;

class AccessAction extends Runnable {

  constructor() {
    super(usage);
  }

  async run(dm: DMService, args: ParsedArgs): Promise<void> {
    let action = args._[2].toLocaleUpperCase() ;
    let requestKey = args._[3] ;
  
    let ro = await dm.policies_request_action(action, requestKey, args._[4] || "")
    console.info(action, " request: ", requestKey, " - ", ro);
  }
}

new AccessAction()
  .execute()
  .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
  .finally(() => process.exit(0));

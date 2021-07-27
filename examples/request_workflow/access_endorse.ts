/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ExampleWrapper } from '../example_wrapper' ;
import { DMService } from '../../dist/api';
import { ParsedArgs } from 'minimist';

let usage = 
"Usage:\n" + 
"   yarn ts-node examples/request_workflow/access_endorse.ts [--help] --url <url> <user> <requestKey> [<message>]\n" + 
"where:\n" + 
"   url         Default: localhost:443\n" +
"   user        mamori server user\n" +
"   password\n" +
"   requestKey  Identifying request key, e.g. 4b9383f4-017a-e5f1-40b9-00001660cb1e, output by access_request.ts\n" +
"   message     Request message" ;

let eg = async function (dm: DMService, args: ParsedArgs) {
  let requestKey = args._[2] ;
  let pp = await dm.policies_get_request_parameters(requestKey) ;
  console.info("Request parameters: ", pp);

  let ro = await dm.policies_request_action('ENDORSE', requestKey, args._[3] || "")
  console.info("Endorsed request: ", requestKey, " - ", ro);
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.usage = usage ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

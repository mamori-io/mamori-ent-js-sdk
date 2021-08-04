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
"   yarn ts-node examples/request_workflow/access_request.ts [--help] --url <url> <user> <password> <policy> [<message>] [--<name>=<value>]\n" + 
"where:\n" + 
"   url         Default: localhost:443\n" +
"   user        mamori server user\n" +
"   password\n" +
"   policy      Access policy name\n" +
"   message     Request message\n" +
"   name        Access policy parameter name and value, e.g. --time=300" ;

let eg = async function (dm: DMService, args: ParsedArgs) {
  let access_policy = args._[2] ;

  // Request procedure metadata
  //
  let po = await dm.policies_get_procedure_options(access_policy) ;
  let optionsMap = new Map(); 
  for(var i = 0; i < po.length; i++) {
    let p = po[i] ;
    optionsMap.set(p.name, p.value) ;
  } 

  let requestMessage = args._[3] || optionsMap.get("request_default_message") || "" ;
  console.info("Request for: ", optionsMap.get("description") || access_policy, " - ", requestMessage);

  // Request arguments
  //
  let pp = await dm.policies_get_procedure_parameters(access_policy) ;
  let pa = new Map(); 
  for(var i = 0; i < pp.length; i++) {
    let p = pp[i] ;
    // Convert any numeric values to be strings.
    pa.set(p.id,  {name: p.name, value: "" + (args[p.name] || p.default_value)}) ;
    console.info("Request parmeter: ", p.name, " = ", pa.get(p.id).value);
  }  

  let o = await dm.policies_request_execute(access_policy, pa.size == 0 ? null : Object.fromEntries(pa), requestMessage);
  console.info("\nRequest key: ", o.request_key, "\n");
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.usage = usage ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

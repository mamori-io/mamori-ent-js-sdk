/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ExampleWrapper } from './example_wrapper' ;
import { DMService } from '../dist/api';
import { ParsedArgs } from 'minimist';

let usage = 
"Usage:\n" + 
"   yarn ts-node <example script> [--help] --url <url> <user> <password> <policy> <table> <column> <transform> [<type>]\n" + 
"where:\n" + 
"   url         Default: localhost:443\n" +
"   user        mamori server user\n" +
"   password\n" +
"   policy      A name for your policy. N.B. the name default is special.\n" +
"   table       A four part table refernce, e.g. MyOracle.ORCL.scott.employee.\n" +
"   column      The column to mask, encrypt,...\n" +
"   transform   The transformation the policy will apply, e.g. \"MASKED BY phone()\" or REVEALED.\n" +
"   type        Optionally either table or resultset. Default: table" ;

let eg = async function (dm: DMService, args: ParsedArgs) {
  let policy_name = args._[2] ;
  let table = args._[3] ;
  let column = args._[4] ;
  let transform = args._[5] ;
  let type = "table" ;
  if (args.length > 6) {
    type = args._[6] ;
  }

  await dm.policies_set_policy_projection(table, column, transform, policy_name, type) ;
  console.info("Created policy: ", policy_name, " for: ", table, ".", column);

  var offResult = await dm.policies_get_policy_projections([["policy", "=", policy_name]]);
  if (offResult.data) {
    for(var i in offResult.data) {
        console.info(policy_name, " policy: ", offResult.data[i]);
    }
  }
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.usage = usage ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

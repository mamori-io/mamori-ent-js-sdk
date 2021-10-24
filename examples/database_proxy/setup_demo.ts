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
import { Role } from '../../dist/role';
import { ParsedArgs } from 'minimist';
  
let revealRoleName: string  = "data_reveal";
let endorseRoleName: string = "data_endorser";
let userRoleName: string    = "data_user";

let projectionName: string = "view_customer_details";
let accessName: string = "data_access";

let usage: string =       
"Usage:\n" + 
"   yarn ts-node --transpile-only examples/database_proxy/setup_demo.ts [--help] [--url <url>] [<user> <password>] [<system>]\n" + 
"where:\n" + 
"   user      mamori server user\n" +
"   password\n" +
"   url       Default: localhost:443\n" +
"   system    Default: oracle\n" +
"\n" +
"After using this script to setup the data demonstration, a user with the data_user role can request access:\n\n" +
"   yarn ts-node --transpile-only examples/request_workflow/access_request.ts [--help] [--url <url>] [<user> <password>] data_access [<message>] [--time=<N>]\n" + 
"\n" +
"This will output a request key, e.g. 03048fd3-017b-0c52-399a-00001660cb1e.\n" +
"The request can be endorsed or denied by a user with the data_endorser role, or cancelled by the requester using:\n\n" +
"   yarn ts-node --transpile-only examples/request_workflow/access_action.ts [--help] --url <url> <user> <action> <requestKey> [<message>]\n" +
"\n" +
"If endorsed, the requester will be granted the data_reveal role temporarily, revealing the masked data for N seconds.\n" ;

let eg = async function (dm: DMService, args: ParsedArgs) {
  //
  // Roles
  //
  let endorseRole = await new Role(endorseRoleName) ;
  if (await endorseRole.get(dm)) {
    console.info("Endorser role: ", endorseRole.name);
  }
  else {
    await endorseRole.create(dm) ;
    console.info("Created role: ", endorseRole.name);
    await endorseRole.grant(dm, ['REQUEST'], "*", false) ;
  }

  let userRole = await new Role(userRoleName) ;
  if (await endorseRuserRoleole.get(dm)) {
    console.info("User role: ", userRole.name);
  }
  else {
    await userRole.create(dm) ;
    console.info("Created role: ", userRole.name);  
  }

  let revealRole = await new Role(revealRoleName) ;
  if (await revealRole.get(dm)) {
    console.info("Reveal role: ", revealRole.name);
  }
  else {
    await revealRole.create(dm) ;
    console.info("Created role: ", revealRole.name);
  }

  //
  //  Access policy 
  //
  let system = args._[2] || "oracle" ;

  // Setup anew
  await dm.policies_set_policy_projection(system + ".orcl.DEMO.customer_pii", "CREDIT_CARD_NO", "MASKED BY credit_card()", "default", null) ;
  await dm.policies_set_policy_projection(system + ".orcl.DEMO.customer_pii", "*", "REVEAL", projectionName, null) ;
  console.info("Created data projection: ", projectionName);

  await dm.policies_create_procedure(accessName,
    {a: {name: "time", description: "Duration of access", default_value: "30"}},
    endorseRoleName,
    "policy",
    "Grant access to customer data",
    userRoleName,
    "",
    "",
    "",
    "",
    "1",
    "",
    "true",
    "",
    "BEGIN; GRANT " + revealRoleName + " TO :applicant VALID FOR :time seconds; END");
  console.info("Created access policy: ", accessName);

  var projectionResult = await dm.get_http_apifilters({ filter: ["name", "=", projectionName] });
  if (projectionResult) {
    await dm.activate_http_apifilter(projectionResult.data[0].id);
    console.info("Activated filter: ", projectionName);
  }
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.usage = usage ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

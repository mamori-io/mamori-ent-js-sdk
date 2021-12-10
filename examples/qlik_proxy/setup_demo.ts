/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { MamoriService } from '../../dist/api';
import { Role } from '../../dist/role';
import { Runnable } from '../../dist/runnable';

let mgrRoleName: string = "qlik_manager";
let userRoleName: string = "qlik_user";
let endorseRoleName: string = "qlik_endorser";
let filterName: string = "qlik_customers";
let accessName: string = "qlik_access";

let usage: string =
  "Usage:\n" +
  "   yarn ts-node --transpile-only examples/qlik_proxy/setup_demo.ts [--help] [--url <url>] [<user> <password>]\n" +
  "where:\n" +
  "   user      mamori server user\n" +
  "   password\n" +
  "   url       Default: localhost:443\n" +
  "\n" +
  "After using this script to setup the qlik demonstration, a user with the qlik_user role can request access:\n\n" +
  "   yarn ts-node --transpile-only examples/request_workflow/access_request.ts [--help] [--url <url>] [<user> <password>] qlik_access [<message>] [--time=<N>]\n" +
  "   \n" +
  "This will output a request key, e.g. 03048fd3-017b-0c52-399a-00001660cb1e.\n" +
  "The request can be endorsed or denied by a user with the qlik_endorser role, or cancelled by the requester using:\n\n" +
  "   yarn ts-node --transpile-only examples/request_workflow/access_action.ts [--help] --url <url> <user> <action> <requestKey> [<message>]\n" +
  "   \n" +
  "If endorsed, the requester will be granted the qlik_manager role temporarily, revealing the masked data for N seconds.\n";

class QlikDemo extends Runnable {

  constructor() {
    super(usage);
  }

  async run(dm: MamoriService, _args: ParsedArgs): Promise<void> {
    //
    // Qlik roles
    //
    let mgrRole = await new Role(mgrRoleName);
    if (await mgrRole.get(dm)) {
      console.info("Endorser role: ", mgrRole.name);
    }
    else {
      await mgrRole.create(dm);
      console.info("Created role: ", mgrRole.name);
      await mgrRole.grant(dm, ['REQUEST'], "*", false);
    }

    let userRole = await new Role(userRoleName);
    if (await userRole.get(dm)) {
      console.info("User role: ", userRole.name);
    }
    else {
      await userRole.create(dm);
      console.info("Created role: ", userRole.name);
    }

    let endorseRole = await new Role(endorseRoleName);
    if (await endorseRole.get(dm)) {
      console.info("Endorser role: ", endorseRole.name);
    }
    else {
      await endorseRole.create(dm);
      console.info("Created role: ", endorseRole.name);
      await endorseRole.grant(dm, ['REQUEST'], "*", false);
    }

    //
    //  Qliksense filter
    //

    // Teardown existing
    var filterResult = await dm.get_http_apifilters([["name", "=", filterName]]);
    if (filterResult.data && filterResult.data.length > 0) {
      await dm.delete_http_apifilter(filterResult.data[0].id);
      console.info("Deleted filter: ", filterName);
    }
    await dm.policies_drop_procedure(accessName);
    console.info("Deleted procedure: ", accessName);

    // Setup anew
    await dm.add_http_apifilter({
      name: filterName,
      system: "qlik",
      type: "qlik",
      path: "Customer Detail",
      method: "",
      queryparameters: "",
      headers: "",
      body: "",
      owner: args._[0],
      transformations:
        '[{"name":"default","priority":1,"function":"MASK HASH","elementSpec":"Customer Name","functionArgs":"MD5"},' +
        '{"name":"default","priority":1,"function":"MASK FULL","elementSpec":"Customer Gender"},' +
        '{"name":"default","priority":1,"function":"MASK FULL","elementSpec":"Sales Revenue (Current Year)","functionArgs":"9|$,"},' +
        '{"name":"qlik_manager","priority":1,"function":"REVEAL","elementSpec":"*"}]',
    });
    console.info("Created Qlik filter: ", filterName);

    await dm.policies_create_procedure(accessName,
      { a: { name: "time", description: "Duration of access", default_value: "30" } },
      endorseRoleName,
      "policy",
      "Grant access to Qlik data",
      userRoleName,
      "",
      "",
      "",
      "",
      "1",
      "",
      "true",
      "",
      "BEGIN; GRANT " + mgrRoleName + " TO :applicant VALID FOR :time seconds; END");
    console.info("Created access policy: ", accessName);

    var filterResult = await dm.get_http_apifilters({ filter: ["name", "=", filterName] });
    if (filterResult) {
      await dm.activate_http_apifilter(filterResult.data[0].id);
      console.info("Activated filter: ", filterName);
    }
  }
}

new QlikDemo()
  .execute()
  .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
  .finally(() => process.exit(0));
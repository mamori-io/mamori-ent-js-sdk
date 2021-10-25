/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { DMService } from '../../dist/api';
import { Role } from '../../dist/role';
import { Runnable } from '../../dist/runnable' ;

let mgrRoleName = "appp_manager";
let userRoleName = "appp_user";
let endorseRoleName = "appp_endorser";
let filterName = "appp_customers";
let accessName = "appp_access";

class ApplicationDemo extends Runnable {
  
  async run(dm: DMService, _args: ParsedArgs): Promise<void> {
    //
    // appp roles
    //
    let mgrRole = await new Role(mgrRoleName) ;
    if (await mgrRole.get(dm)) {
      console.info("Endorser role: ", mgrRole.name);
    }
    else {
      await mgrRole.create(dm) ;
      console.info("Created role: ", mgrRole.name);
      await mgrRole.grant(dm, ['REQUEST'], "*", false) ;
    }

    let userRole = await new Role(userRoleName) ;
    if (await userRole.get(dm)) {
      console.info("User role: ", userRole.name);
    }
    else {
      await userRole.create(dm) ;
      console.info("Created role: ", userRole.name);
    }

    let endorseRole = await new Role(endorseRoleName) ;
    if (await endorseRole.get(dm)) {
      console.info("Endorser role: ", endorseRole.name);
    }
    else {
      await endorseRole.create(dm) ;
      console.info("Created role: ", endorseRole.name);
      await endorseRole.grant(dm, ['REQUEST'], "*", false) ;
    }

    //
    //  apppsense filter
    //

    // Teardown existing
    //
    var filterResult = await dm.get_http_apifilters([["name", "=", filterName]]);
    if (filterResult.data && filterResult.data.length > 0) {
      await dm.delete_http_apifilter(filterResult.data[0].id);
      console.info("Deleted filter: ", filterName);
    }
    await dm.policies_drop_procedure(accessName);
    console.info("Deleted procedure: ", accessName);

    // Setup anew
    //
    await dm.add_http_apifilter({
      name: filterName,
      system: "appp",
      type: "appp",
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
        '{"name":"appp_manager","priority":1,"function":"REVEAL","elementSpec":"*"}]',
    });
    console.info("Created appp filter: ", filterName);

    await dm.policies_create_procedure(accessName,
      {a: {name: "time", description: "Duration of access", default_value: "30"}},
      endorseRoleName,
      "policy",
      "Grant access to appp data",
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
      console.info("Activeted filter: ", filterName);
    }
  }
}

new ApplicationDemo()
  .execute()
  .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
  .finally(() => process.exit(0));

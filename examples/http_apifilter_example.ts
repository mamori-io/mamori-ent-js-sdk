/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { MamoriService } from '../dist/api';
import { Role } from '../dist/role';
import { Runnable } from '../dist/runnable';

let mgrRoleName = "data_manager";
let userRoleName = "data_user";
let revealRoleName = "data_reveal";

let filterName = "openfoodfacts";

class HttpApiFilterExample extends Runnable {

  async run(dm: MamoriService, args: ParsedArgs): Promise<void> {
    let mamoriUser = args._[0];

    // Roles
    //
    let mgrRole = await new Role(mgrRoleName);
    if (await mgrRole.get(dm)) {
      console.info("Endorser role: ", mgrRole.roleid);
    }
    else {
      await mgrRole.create(dm);
      console.info("Created role: ", mgrRole.roleid);
      await mgrRole.grant(dm, ['REQUEST'], "*", false);
    }

    let userRole = await new Role(userRoleName);
    if (await userRole.get(dm)) {
      console.info("User role: ", userRole.roleid);
    }
    else {
      await userRole.create(dm);
      console.info("Created role: ", userRole.roleid);
    }

    let revealRole = await new Role(revealRoleName);
    if (await revealRole.get(dm)) {
      console.info("Endorser role: ", revealRole.roleid);
    }
    else {
      await revealRole.create(dm);
      console.info("Created role: ", revealRole.roleid);
      await revealRole.grant(dm, ['REQUEST'], "*", false);
    }

    console.info("");

    //  https://world.openfoodfacts.org/
    //
    var offResult = await dm.get_http_apifilters([["name", "=", filterName]]);
    if (offResult.data) {
      for (var i in offResult.data) {
        if (filterName == offResult.data[i].name) {
          await dm.delete_http_apifilter(offResult.data[i].id);
          console.info("Deleted filter: ", filterName);
        }
      }
    }

    await dm.add_http_apifilter({
      name: filterName,
      system: filterName,
      type: "api",
      path: "/api/v0/product/737628064502.json",
      method: "GET",
      queryparameters: "",
      headers: "",
      body: "",
      owner: mamoriUser,
      transformations: '[{"name": "default", "priority": 1, "elementSpec": "$..sugars", "function": "MASK FULL"}]'
    });
    console.info("Created filter: ", filterName);

    var offResult = await dm.get_http_apifilters({ filter: ["name", "=", filterName] });
    if (offResult.data) {
      for (var i in offResult.data) {
        if (filterName == offResult.data[i].name) {
          console.info(filterName, " filter: ", offResult.data[i]);
          await dm.activate_http_apifilter(offResult.data[i].id);
        }
      }
    }
  }
}

new HttpApiFilterExample().execute();

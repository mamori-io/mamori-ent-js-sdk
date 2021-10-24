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
import { Role } from '../dist/role';
import { ParsedArgs } from 'minimist';

let mgrRoleName = "data_manager";
let userRoleName = "data_user";
let revealRoleName = "data_reveal";

let filterName = "openfoodfacts";

let eg = async function (dm: DMService, args: ParsedArgs) {
  let mamoriUser = args._[0] ;

  // Roles
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

  let endorseRole = await new Role(revealRoleName) ;
  if (await endorseRole.get(dm)) {
    console.info("Endorser role: ", endorseRole.name);
  }
  else {
    await endorseRole.create(dm) ;
    console.info("Created role: ", endorseRole.name);
  }

  console.info("");

  //  https://world.openfoodfacts.org/
  //
  var offResult = await dm.get_http_apifilters([["name", "=", filterName]]);
  if (offResult.data) {
    for(var i in offResult.data) {
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
    for(var i in offResult.data) {
      if (filterName == offResult.data[i].name) {
        console.info(filterName, " filter: ", offResult.data[i]);
        await dm.activate_http_apifilter(offResult.data[i].id);
      }
    }
  }
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ExampleWrapper } from './example_wrapper' ;
import { DMService } from '../src/api';
import { ParsedArgs } from 'minimist';

let roleId = "test_role" ;

let eg = async function (dm: DMService, args: ParsedArgs) {
  let mamoriUser = args._[0] ;
  
  try {
    // Revoke from any users
    let grantees = await dm.search_users_with_role(roleId, {"assignedonly": "Y"}) ;
    for(var i in grantees.data) {
      await dm.revoke_role_from_grantee(roleId, grantees.data[i].username) ;
      console.info("Revoked: ", roleId, " from: ", grantees.data[i].username);
    }

    // Revoke from any roles
    await dm.revoke_role_from_grantee(roleId, "secure_connect") ;
    console.info("Revoked: ", roleId, " from: ", "secure_connect");

    await dm.delete_role(roleId);
    console.info("Delete role: ", roleId);
  }
  catch (e) {
    console.info("Delete role: ", (e as Error).message);
  }

  console.info("\nCreating role: ", roleId);
  await dm.create_role({roleid: roleId, externalname: "Test role"});
  await dm.grant_role_to_grantee(roleId, mamoriUser);
  await dm.grant_role_to_grantee(roleId, "secure_connect");

  let grantedRoles = await dm.get_grantee_roles(roleId) ;
  console.info(roleId, " granted roles: ", grantedRoles);

  let grantees = await dm.search_users_with_role(roleId, {"assignedonly": "Y"}) ;
  var grantedTo:string[] = [] ;
  for(var i in grantees.data) {
    grantedTo.push(grantees.data[i].username) ;
  }
  console.info(roleId, " granted to: ", grantedTo);

  let roles = await dm.user_roles(mamoriUser) ;
  console.info(mamoriUser, " Roles: ", roles);
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { Runnable } from '../dist/runnable' ;
import { DMService } from '../dist/api';
import { Role } from '../dist/role';

let roleId = "test_role" ;

class CreateRoleExample extends Runnable {
  
  async run(api: DMService, args: ParsedArgs): Promise<void> {
    let mamoriUser = args._[0] ;
    
    let role = new Role(roleId) ;
    try {
      // Revoke from any users
      let grantees = await api.search_users_with_role(roleId, {"assignedonly": "Y"}) ;
      for(var i in grantees.data) {
        await role.revoke(api, grantees.data[i].username) ;
        console.info("Revoked: ", role.name, " from: ", grantees.data[i].username);
      }

      // Revoke from any roles
      await api.revoke_role_from_grantee(roleId, "secure_connect") ;
      console.info("Revoked: ", roleId, " from: ", "secure_connect");

      await api.delete_role(roleId);
      console.info("Delete role: ", roleId);
    }
    catch (e) {
      console.info("Delete role: ", (e as Error).message);
    }

    console.info("\nCreating role: ", roleId);
    await api.create_role({roleid: roleId, externalname: "Test role"});
    await api.grant_role_to_grantee(roleId, mamoriUser);
    await api.grant_role_to_grantee(roleId, "secure_connect");

    let grantedRoles = await api.get_grantee_roles(roleId) ;
    console.info(roleId, " granted roles: ", grantedRoles);

    let grantees = await api.search_users_with_role(roleId, {"assignedonly": "Y"}) ;
    var grantedTo:string[] = [] ;
    for(var i in grantees.data) {
      grantedTo.push(grantees.data[i].username) ;
    }
    console.info(roleId, " granted to: ", grantedTo);

    let roles = await api.user_roles(mamoriUser) ;
    console.info(mamoriUser, " Roles: ", roles);
  }
}

new CreateRoleExample().execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

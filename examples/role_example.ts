/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { DMService } from '../dist/api';
import { Role } from '../dist/role';
import { Runnable } from '../dist/runnable';

class RoleExample extends Runnable {

  async run(api: DMService, args: ParsedArgs): Promise<void> {
    let mamoriUser = args._[0];

    let role = new Role("test_role", "Test role");
    try {
      // Revoke from any users or roles
      let grantees = await role.getGrantees(api);
      for (var i in grantees) {
        await role.revokeFrom(api, grantees[i].grantee);
        console.info("Revoked: ", role.roleid, " from: ", grantees[i].grantee);
      }

      await role.delete(api);
      console.info("Delete role: ", role.roleid);
    }
    catch (e) {
      console.info("Delete role: ", (e as Error).message);
    }

    console.info("\nCreating role: ", role.roleid);
    await role.create(api);
    await role.grantTo(api, "test_user");
    await role.grantTo(api, "mamori_admin");

    let grantees = await role.getGrantees(api);
    for (var i in grantees) {
      console.info(role.roleid, " granted to: ", grantees[i].type, " ", grantees[i].grantee);
    }

    let roles = await Role.getAllGrantedRoles(api, mamoriUser);
    console.info(mamoriUser, " Roles: ", roles);
  }
}

new RoleExample().execute() ;

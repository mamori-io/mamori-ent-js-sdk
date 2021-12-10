/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 *
  *  */

import { MamoriService } from '../dist/api';
import { Runnable } from "../dist/runnable";
import { ParsedArgs } from "minimist";

let grantRole = "mamori_admin";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only scripts/create_admin.ts [--help] [--url <url>] <user> <password> <admin user> <admin password>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   admin user          admin username\n" +
    "   admin password      admin password\n";

class CreateAdmin extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: MamoriService, args: ParsedArgs): Promise<void> {

        let admin_user = args._[2];
        let admin_password = args._[3];

        console.info(`Creating admin user ${admin_user}...`);
        await dm.create_user({
            username: admin_user,
            password: admin_password,
            fullname: "SDK Admin User",
            identified_by: "password",
            email: `${admin_user}@mamori.io`
        });
        console.info(`Created admin user ${admin_user}`);

        console.info(`Granting admin role...`);
        await dm.grant_role_to_grantee(grantRole, admin_user);
        console.info(`Granted admin role.`);

        let users = JSON.stringify(await dm.users());
        console.info(`users ${users}`);
    }
}
new CreateAdmin().execute();


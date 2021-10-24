/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 *
 */

import {DMService} from '../dist/api';
import {Runnable} from "../dist/runnable";
import {ParsedArgs} from "minimist";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only examples/configure/grant_role.ts [--help] [--url <url>] <user> <password> <role> <grantee role>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   role                Role to grant\n" +
    "   grantee role        Role to grant to\n";
// TODO Optional valid from/to

class GrantRole extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {


        let user_or_role = args._[2];
        let role = args._[3];

        console.info(`Granting  ${role} to user/role ${user_or_role}`);
        await dm.grant_role_to_grantee(role, user_or_role);


    }
}
new GrantRole().execute();


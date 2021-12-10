/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService } from '../dist/api';
import { ParsedArgs } from "minimist";
import { Runnable } from "../dist/runnable";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only scripts/grant_role.ts [--help] [--url <url>] <user> <password> <role> <grantee role>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password\n" +
    "   url                 Default: localhost:443\n" +
    "   role                Role to grant\n" +
    "   grantee role        Role to grant to\n";
// TODO Optional valid from/to

class GrantRole extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: MamoriService, args: ParsedArgs): Promise<void> {
        let user_or_role = args._[2];
        let role = args._[3];

        console.info(`Granting  ${role} to user/role ${user_or_role}`);
        await dm.grant_role_to_grantee(role, user_or_role);
    }
}

new GrantRole().execute();

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
    "   yarn ts-node --transpile-only scripts/grant.ts [--help] [--url <url>] <user> <password> <user_or_role> <grantable> <object_name>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password\n" +
    "   url                 Default: localhost:443\n" +
    "   user_or_role        Grantee\n" +
    "   grantable           Privilege\n" +
    "   object_name         On resource\n";
// TODO Optional object_name
// TODO Optional valid from/to

class Grant extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: MamoriService, args: ParsedArgs): Promise<void> {
        let user_or_role = args._[2];
        let grantable = args._[3];
        let object_name = args._[4];

        console.info(`Granting  ${grantable} to user/role ${user_or_role} on ${object_name}`);
        await dm.grant_to(user_or_role, [grantable], object_name);
    }
}

new Grant().execute();

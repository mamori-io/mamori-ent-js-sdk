/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 *
 */

import {DMService} from '../../dist/api';
import {Runnable} from "../runnable";
import {ParsedArgs} from "minimist";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only examples/configure/grant.ts [--help] [--url <url>] <user> <password> <user_or_role> <grantable> <object_name>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   user_or_role        Grantee\n" +
    "   grantable           Privilege\n" +
    "   object_name         On resource\n";

class Grant extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {


        let user_or_role = args._[2];
        let grantable = args._[3];
        let object_name = args._[4];

        console.info(`Granting  ${grantable} to user/role ${user_or_role} on ${object_name}`);
        await dm.grant(user_or_role,grantable,object_name);


    }
}
new Grant().execute();


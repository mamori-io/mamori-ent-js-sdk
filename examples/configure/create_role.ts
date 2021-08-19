/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 *
  *  */

import {DMService} from '../../dist/api';
import {Runnable} from "../runnable";
import {ParsedArgs} from "minimist";


let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only examples/configure/create_role.ts [--help] [--url <url>] <user> <password> <role>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   role                role name\n";

class CreateRole extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {

        let rolename = args._[2];
        console.log(`Creating ${rolename}...`);
        await dm.create_role({roleid: rolename, externalname: rolename});
        let roles = JSON.stringify(await dm.roles());
        console.info(`roles ${roles}`);
    }
}
new CreateRole().execute();


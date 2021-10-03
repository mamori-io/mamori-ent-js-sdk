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
    "   yarn ts-node --transpile-only examples/configure/create_user.ts [--help] [--url <url>] <user> <password> <new user> <new password>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   new user            username of user to create\n" +
    "   new password        user's password\n";

class CreateUser extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {

        let admin_user = args._[2];
        let admin_password = args._[3];

        console.info(`Creating  user ${admin_user}...`);
        let user = JSON.stringify(await dm.create_user({
            username: admin_user,
            password: admin_password,
            fullname: "SDK User",
            identified_by: "password",
            email: `${admin_user}@mamori.io`
        }));

        console.info(`user ${user}`);
    }
}
new CreateUser().execute();


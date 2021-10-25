/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import {DMService} from '../dist/api';
import {ParsedArgs} from "minimist";
import {Role} from "../dist/role";
import {Runnable} from "../dist/runnable";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only script/create_role.ts [--help] [--url <url>] <user> <password> <role> [externalName [priority]]\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password\n" +
    "   url                 Default: localhost:443\n" +
    "   role                role name\n";

class CreateRole extends Runnable {

    constructor() {
        super(usage);
    }

    async run(api: DMService, args: ParsedArgs): Promise<void> {
        let role = new Role(args._[2]);
        if (args.length > 3) {
            role.as(args._[3]) ;
            if (args.length > 4) {
                role.at(args._[5] as unknown as number) ;
            }
        }

        console.log(`Creating ${role.name}...`);
        await role.create(api);

        let roles = JSON.stringify(await Role.getAll(api));
        console.info(`All roles ${roles}`);
    }
}

new CreateRole().execute();

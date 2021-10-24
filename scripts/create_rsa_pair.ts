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
    "   yarn ts-node --transpile-only examples/configure/create_rsa_pair.ts [--help] [--url <url>] <user> <password> <rsa_key_name>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   rsa_key_name        key name\n";


class CreateRsaKey extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {

        let rsakey_name = args._[2];

        console.info(`Creating rsa_pair network connection ${rsakey_name}...`);

        let options = {
            name: rsakey_name,
            size: 1024
        };

        await dm.create_rsa_pair(options);
        console.info(`Created rsa_pair network connection ${rsakey_name}`);

        let keys = JSON.stringify(await dm.get_encryption_keys());

        console.info(`keys ${keys}`);

    }
}
new CreateRsaKey().execute();


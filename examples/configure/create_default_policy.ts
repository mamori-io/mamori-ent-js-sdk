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
    "   yarn ts-node --transpile-only examples/configure/create_default_policy.ts [--help] [--url <url>] <user> <password> <policy_name> <ds_name> <db> <schema> <table> <column> <masking function>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   ds_name             Datasource name\n" +
    "   db                  Database \n" +
    "   schema              Schema e.g dbo\n" +
    "   table               Table\n" +
    "   column              Column\n" +
    "   masking_function    Masking function. Defaults to MASKED BY full()\n";

class CreateDefaultPolicy extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {

        let ds = args._[2];
        let db = args._[3];
        let schema = args._[4];
        let table = args._[5];
        let column = args._[6];
        let projection_exp = (args._[7] == undefined) ? 'MASKED BY full()' : args._[7];


        let table_to_mask = `\"${ds}\".\"${db}\".\"${schema}\".\"${table}\"`;
        console.info(`Creating  policy default to mask  ${table_to_mask}.${column} with ${projection_exp}`);


        await dm.policies_set_policy_projection(table_to_mask,column,projection_exp,'default','table');


    }
}
new CreateDefaultPolicy().execute();


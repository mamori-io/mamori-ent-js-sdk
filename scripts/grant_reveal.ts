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
import {Runnable} from "../dist/runnable";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only scripts/grant_reveal.ts [--help] [--url <url>] <user> <password> <policy_name> <ds_name> <db> <schema> <table> <user or role>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password\n" +
    "   url                 Default: localhost:443\n" +
    "   ds_name             Datasource name\n" +
    "   db                  Db\n" +
    "   schema              Schema e.g dbo\n" +
    "   table               Table\n" +
    "   user or role        Grantee\n";

class GrantReveal extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {
        let ds = args._[2];
        let db = args._[3];
        let schema = args._[4];
        let table = args._[5];
        let user_or_role = args._[6];

        let table_to_reveal = `\"${ds}\".\"${db}\".\"${schema}\".\"${table}\"`;
        let sql = `GRANT REVEAL * on ${table_to_reveal} to ${user_or_role}`;
        console.info(`Granting reveal on all columns for  ${table_to_reveal} to user/role ${user_or_role} ...`);
        await dm.query(sql);

        let cred = JSON.stringify(await dm.get_role_credentials(user_or_role));
        console.info(`${user_or_role} has ${cred}`);
    }
}

new GrantReveal().execute();

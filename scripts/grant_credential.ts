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
    "   yarn ts-node --transpile-only scripts/grant_credential.ts [--help] [--url <url>] <user> <password> <user or role> <ds name> <db user> <db password>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password\n" +
    "   url                 Default: localhost:443\n" +
    "   user_or_role        Grantee\n" +
    "   ds_name             Datasource\n" +
    "   db_user             Datasource user login e.g sa\n" +
    "   db_pwd              Datasource password\n";

class GrantCredential extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: MamoriService, args: ParsedArgs): Promise<void> {
        let user_or_role = args._[2];
        let ds_name = args._[3];
        let ds_user = args._[4];
        let ds_pwd = args._[5];

        console.log(`Adding credential for datasource ${ds_name} to user ${user_or_role}`);
        await dm.add_datasource_authorization_to(user_or_role, ds_name, ds_user, ds_pwd)
    }
}

new GrantCredential().execute();

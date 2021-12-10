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
    "   yarn ts-node --transpile-only scripts/create_mssql_ds.ts [--help] [--url <url>] <user> <password> <ds_name> <ds_host> <ds_user> <ds_pwd> <ds_db>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password\n" +
    "   url                 Default: localhost:443\n" +
    "   ds_name             Datasource name\n" +
    "   ds_host             Datasource ip or servername\n" +
    "   ds_user             Datasource user login e.g sa\n" +
    "   ds_pwd              Datasource password\n" +
    "   ds_db               Datasource default db\n";

class CreateMSSQLDatasource extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: MamoriService, args: ParsedArgs): Promise<void> {
        let ds_name = args._[2];
        let ds_host = args._[3];
        let ds_user = args._[4];
        let ds_pwd = args._[5];
        let ds_db = args._[6];
        console.info(`Creating MSQL datasource ${ds_name}...`);

        let rec = {
            name: ds_name,
            type: "SQLSERVER",
            host: ds_host,
        };

        // assumes JDBC driver is installed as mssqlserver
        let options = `PORT '1433', DRIVER 'mssqlserver', USER '${ds_user}', PASSWORD '${ds_pwd}', DEFAULTDATABASE '${ds_db}', TEMPDATABASE '${ds_db}'`;

        await dm.create_system_for_rec("N", rec, options, {});
        console.info(`Created MSQL datasource ${ds_name}`);

        let dss = JSON.stringify(await dm.user_systems());

        console.info(`Datasources ${dss}`);

        console.log(`Adding credential for datasource to current user...${args._[0]}`);
        await dm.add_datasource_authorization_to(args._[0], ds_name, ds_user, ds_pwd)
    }
}

new CreateMSSQLDatasource().execute();

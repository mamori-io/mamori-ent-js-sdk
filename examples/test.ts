/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ExampleWrapper } from './example_wrapper' ;
import { DMService } from '../dist/api';
import { ParsedArgs } from 'minimist';

let eg = async function (dm: DMService, args: ParsedArgs) {
    console.info("ping", await dm.ping());

    console.info("\nFetching connection totals for the last hour...");
    let now = new Date();
    let then = new Date(now.getTime() - 1000 * 3600); // 1 hour ago
    let from_date = then.toISOString().replace("T", " ").replace(/\..*$/, "");
    let to_date   =  now.toISOString().replace("T", " ").replace(/\..*$/, "");
    console.info("Totals: ", await dm.call_operation("connection_totals", {from_date: from_date, to_date: to_date}));

    console.info("\nFetching server version...");
    console.info("Version: ", await dm.server_version());

    console.info("\nFetching SSH logins...");
    console.info("SSH logins:", await dm.ssh_logins());
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

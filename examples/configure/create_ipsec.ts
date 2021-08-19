/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 *
 * 0. create admin login & disable default root boostrap account
 */

import {DMService} from '../../dist/api';
import {Runnable} from "../runnable";
import {ParsedArgs} from "minimist";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only examples/configure/create_ipsec.ts [--help] [--url <url>] <user> <password> <ipsec name> <ipsec host> <ipsec pwd> <ipsec psk>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:443" +
    "   ipsec_name          ipsec name\n" +
    "   ipsec_host          ipsec host\n" +
    "   ipsec_pwd           ipsec password\n" +
    "   ipsec_psk           ipsec psk\n";

class CreateIpsec extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {

        let ipsec_name = args._[2];
        let ipsec_host = args._[3];
        let ipsec_pwd = args._[4];
        let ipsec_psk = args._[5];

        console.info(`Creating ipsec network connection ${ipsec_name}...`);

        let vpn = {
            vpn: {
                name: ipsec_name,
                type: 'ipsec',
                config: {
                    host:  ipsec_host,
                    username: 'mamori'
                },
                secrets: [
                    {
                        name: 'password',
                        value: ipsec_pwd
                    },
                    {
                        name: 'psk',
                        value: ipsec_psk
                    }]
            }
        };
        await dm.add_vpn(vpn);
        console.info(`Created ipsec network connection ${ipsec_name}`);

        let vpns = JSON.stringify(await dm.get_vpns());

        console.info(`vpns ${vpns}`);
    }
}
new CreateIpsec().execute();


/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import {DMService} from '../../dist/api';
import {IpSecVpn} from '../../dist/network';
import {Runnable} from "../runnable";
import {ParsedArgs} from "minimist";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only examples/configure/create_ipsec.ts [--help] [--url <url>] <user> <password> <ipsec name> [--force] <ipsec host> <ipsec pwd> <ipsec psk>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password\n" +
    "   url                 Default: localhost:443\n" +
    "\n" +
    "   ipsec_name          ipsec name\n" +
    "   ipsec_host          ipsec host\n" +
    "   ipsec_pwd           ipsec password\n" +
    "   ipsec_psk           ipsec psk\n" +
    "   force               Force creation by deleting any existing VPN of the same name.\n";

class CreateIpsec extends Runnable {

    constructor() {
        super(usage, {
            string: ['url', '-f'],
            alias: {h: 'help', f: 'force'},
            default: {url: 'localhost:443'},
            '--': true,
        });
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {
        let vpn = new IpSecVpn(args._[2]) ;
        if (args.f) {
            try {
                await vpn.delete(dm) ;
                console.info("Deleted VPN: ", vpn.name);
            }
            catch (e) {
                console.info("Delete VPN: ", (e as Error).message);
            }
        }

        console.info(`Creating IPSEC network connection: ${vpn.name} ...`);
        await vpn.at(args._[3])
           .withCredentials('mamori', args._[4])
           .withPreSharedKey(args._[5])
           .create(dm) ;
        console.info(`Created IPSEC network connection: ${vpn.name}`);

        let vpns = JSON.stringify(await IpSecVpn.getAll(dm));
        console.info(`All VPNs: ${vpns}`);
    }
}

new CreateIpsec().execute();

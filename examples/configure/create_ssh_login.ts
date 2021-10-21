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
import {SshLogin} from '../../dist/ssh_login';
import {Runnable} from "../runnable";
import {ParsedArgs} from "minimist";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only examples/configure/create_mssql_ds.ts [--help] [--url url] user password name host[:port] user key_name [ssh_password] [--force] \n" +
    "where:\n" + 
    "   user\t\tmamori server user\n" +
    "   password\n" +
    "   url\t\tDefault: localhost:443\n" + 
    "\n" + 
    "   name\t\tSSH Login name\n" +
    "   host\t\tTarget hostname or IP address\n" +
    "   port\t\tTarget port\n" +
    "   user\t\tSSH login user\n" +
    "   key_name\tSSH key name\n" +
    "   ssh_password\tOptional SSH login password\n" +
    "   force\t\tForce creation by deleting any existing SSH Login of the same name.\n";

class CreateSshLogin extends Runnable {

    constructor() {
        super(usage, {
            string: ['url', '-f'],
            alias: {h: 'help', f: 'force'},
            default: {url: 'localhost:443'},
            '--': true,
        });
    }

    async run(dm: DMService, args: ParsedArgs): Promise<void> {
        let sshLogin = new SshLogin(args._[2]) ;
        if (args.f) {
            try {
                await sshLogin.delete(dm) ;
                console.info("Deleted SSH Login: ", sshLogin.name);
            }
            catch (e) {
                console.info("Delete SSH Login: ", (e as Error).message);
            }
        }

        let hostArgs: string[] = args._[3].split(':') ;
        let host = hostArgs[0];
        let port = 22 ;
        if (hostArgs.length > 1) {
            port = hostArgs[1] as unknown as number ;
        }

        console.info(`Creating SSH Login: ${sshLogin.name} to ${host}:${port} ...`);

        await sshLogin.at(host, port)
                      .withCredentials(args._[4], args._[5], (args.length > 6 ? args._[6] : null)) 
                      .create(dm);
        console.info(`Created SSH Login: ${sshLogin.name}`);

        return null ;
    }
}

new CreateSshLogin()
    .execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

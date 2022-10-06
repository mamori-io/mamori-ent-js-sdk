/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
// allow for self signed certs

import minimist = require('minimist');
import { ParsedArgs } from 'minimist';
import { MamoriService } from './api';
/**
 * Base class for runnable script snippets. Sublass and implement the run method.
 */
export abstract class Runnable {

    protected args: ParsedArgs;
    protected usage: string;

    constructor(usage?: string, parseOptions?: Object) {
        if (usage == void 0) {
            this.usage =
                "Usage:\n" +
                "   yarn ts-node " + this.constructor.name + " [--help] [--url url] user password\n" +
                "where:\n" +
                "   user\t\tmamori server user\n" +
                "   password\tuser password\n" +
                "   url\t\tDefault: localhost:443\n";
        }
        else {
            this.usage = usage;
        }

        if (parseOptions === void 0) {
            this.args = minimist(process.argv.slice(2), {
                string: ['url'],
                alias: { h: 'help' },
                default: { url: 'localhost:443' },
                '--': true,
            });
        }
        else {
            this.args = minimist(process.argv.slice(2), parseOptions);
        }
    }

    /**
     * Execute SDK snippet.
     */
    public async execute() {
        if (this.args.help) {
            console.log("\n" + this.usage + "\n");
            return;
        }

        let host = "https://" + this.args.url + "/";
        let api = new MamoriService(host);
        try {
            console.info("\nConnecting to %s...", host);
            let uname = this.args._[0];
            let pw = this.args._[1].toString();
            let login = await api.login(uname, pw);
            console.info("Login successful for: ", login.fullname || login.name, ", session: ", login.session_id, "\n");

            await this.run(api, this.args);
        }
        catch (e) {
            console.error(e.response == undefined ? e : e.response.status + " " + e.response.statusText + " - " + JSON.stringify(e.response.data));
            process.exitCode = -1;
            if (e.response && e.response.status) {
                process.exitCode = e.response.status;
            }
        }
        finally {
            console.info("\nDisconnecting...");
            api.logout();
        }
    }

    /**
     * Override in subclasses
     * @param dm   API client
     * @param args Command line arguments
     */
    abstract run(dm: MamoriService, args: ParsedArgs): Promise<void>;
}
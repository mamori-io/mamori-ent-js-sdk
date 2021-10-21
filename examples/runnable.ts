/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
// allow for self signed certs
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import {DMService} from '../dist/api';
import minimist = require('minimist');
import {ParsedArgs} from 'minimist';

/**
 * Base class for runnable script snippets. Sublass and implement the run method.
 */
export abstract class Runnable {

    protected args: ParsedArgs;
    protected usage: string;

    constructor(usage: string, parseOptions?: Object) {
        this.usage = usage;
        if (parseOptions === void 0) {
            this.args = minimist(process.argv.slice(2), {
                string: ['url'],
                alias: {h: 'help'},
                default: {url: 'localhost:443'},
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

        let dm = new DMService("https://" + this.args.url + "/");
        try {
            console.info("\nConnecting...");
            let login = await dm.login(this.args._[0] || "root", this.args._[1] || "test");
            console.info("Login successful for: ", login.fullname || login.name, ", session: ", login.session_id);

            await this.run(dm, this.args);
        } 
        catch (err) {
            console.error(err);
        } 
        finally {
            console.info("\nDisconnecting...");
            await dm.logout();
        }
    }

    /**
     * Override in subclasses
     * @param dm   API client
     * @param args Command line arguments
     */
    abstract run(dm: DMService, args: ParsedArgs): Promise<void>;
}
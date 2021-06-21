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

import { DMService } from '../src/api';
import minimist = require('minimist');
import { ParsedArgs } from 'minimist';

export type ExampleCallback = (dm: DMService, args: ParsedArgs) => void;

export class ExampleWrapper {

  private args: ParsedArgs;
  private eg: ExampleCallback;

  public usage: string =       
    "Usage:\n" + 
    "   yarn ts-node <example script> [--help] [--url <url>] [<user> <password>]\n" + 
    "where:\n" + 
    "   user      mamori server user\n" +
    "   password\n" +
    "   url       Default: localhost:443" ;

  constructor(eg: ExampleCallback, argv: string[], parseOptions?: Object) {
    this.eg = eg;
    if (parseOptions === void 0) {
      this.args = minimist(argv.slice(2), {
        string: ['url'],
        alias: { h: 'help' },
        default: { url: 'localhost:443' },
        '--': true,
      });
    }
    else {
      this.args = minimist(argv.slice(2), parseOptions);
    }
  }

  public async execute() {
    if (this.args.help) {
      console.log("\n" + this.usage + "\n");
      return ;
    }

    let dm = new DMService("https://" + this.args.url + "/");

    console.info("\nConnecting...");
    let login = await dm.login(this.args._[0] || "root", this.args._[1] || "test");
    console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
    console.info("");

    await this.eg(dm, this.args);
    await dm.logout();
  }
}

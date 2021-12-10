/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { MamoriService } from '../dist/api';
import { Runnable } from '../dist/runnable';

let usage =
  "Usage:\n" +
  "   yarn ts-node examples/create_column_mask.ts [--help] --url <url> <user> <password> <policy> <table> <column> <transform> [<type>]\n" +
  "where:\n" +
  "   url         Default: localhost:443\n" +
  "   user        mamori server user\n" +
  "   password\n" +
  "   policy      A name for your policy. N.B. the name default is special.\n" +
  "   table       A four part table refernce, e.g. MyOracle.ORCL.scott.employee.\n" +
  "   column      The column to mask, encrypt,...\n" +
  "   transform   The transformation the policy will apply, e.g. \"MASKED BY phone()\" or REVEALED.\n" +
  "   type        Optionally either table or resultset. Default: table";

class Example extends Runnable {

  constructor() {
    super(usage);
  }

  async run(dm: MamoriService, args: ParsedArgs): Promise<void> {
    let policy_name = args._[2];
    let table = args._[3];
    let column = args._[4];
    let transform = args._[5];
    let type = "table";
    if (args.length > 6) {
      type = args._[6];
    }

    await dm.policies_set_policy_projection(table, column, transform, policy_name, type);
    console.info("Created policy: ", policy_name, " for: ", table, ".", column);

    var offResult = await dm.policies_get_policy_projections({ filter: ["name", "=", policy_name] });
    if (offResult.data) {
      for (var i in offResult.data) {
        console.info(policy_name, " policy: ", offResult.data[i]);
      }
    }
  }
}

new Example().execute();

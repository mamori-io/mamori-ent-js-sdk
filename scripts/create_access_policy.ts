/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 *
 */

import { MamoriService } from '../../dist/api';
import { Runnable } from "../runnable";
import { ParsedArgs } from "minimist";

let usage: string =
    "Usage:\n" +
    "   yarn ts-node --transpile-only examples/configure/create__access_ policy.ts [--help] [--url <url>] <user> <password> <policy_name> <request_role> <endorse_role> <grant_role> <minutes>\n" +
    "where:\n" +
    "   user                mamori server user\n" +
    "   password            user password" +
    "   url                 Default: localhost:" +
    "   policy_name         policy name\n" +
    "   request_role        request_role required to request policy\n" +
    "   endorse_role        endorse_role requried to endorse policy \n" +
    "   grant_role          Role to grant to requester on execution of the policy\n" +
    "   minutes             Duration of grant\n";

class CreateAccessPolicy extends Runnable {

    constructor() {
        super(usage);
    }

    async run(dm: MamoriService, args: ParsedArgs): Promise<void> {

        let policy_name = args._[2];
        let request_role = args._[3];
        let endorse_role = args._[4];
        let grant_role = args._[5];
        let minutes = args._[6];

        // SQL snippet to grant role to requester/applicant
        let sql = `BEGIN; GRANT ${grant_role} TO :applicant VALID for ${minutes} minutes; END;`;

        console.info(`Creating access policy  to grant ${grant_role} to an applicant for ${minutes} minutes...`);

        await dm.policies_create_procedure(
            policy_name, null,
            endorse_role,
            'policy',
            policy_name,
            request_role,
            "",
            "",
            "",
            "",
            '1',
            "",
            "true",
            "",
            "true",
            sql);

    }
}
new CreateAccessPolicy().execute();


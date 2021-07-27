/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ExampleWrapper } from '../example_wrapper' ;
import { DMService } from '../../dist/api';
import { ParsedArgs } from 'minimist';

let eg = async function (dm: DMService, args: ParsedArgs) {
  console.info("\nFetching user systems...");
  let systems = await dm.user_systems();
  console.info("Systems: ", systems);
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

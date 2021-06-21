/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ExampleWrapper } from './example_wrapper' ;
import { DMService } from '../src/api';
import { ParsedArgs } from 'minimist';

let eg = async function (dm: DMService, args: ParsedArgs) {
  try {
    let dsystem = await dm.delete_system("test_system") ;
    console.info("Delete system: ", dsystem);
  }
  catch (e) {
    console.info("Delete system: ", (e as Error).message);
  }

  await dm.create_system_for_rec("N",
    { name: "test_system", type: "POSTGRESQL", host: "10.0.2.2" },
    "PORT '5432', DRIVER 'postgres', USER 'postgres', PASSWORD 'postgres', DEFAULTDATABASE 'mamori', TEMPDATABASE 'mamori'",
    { a: { system_name: "test_system", cirro_user: args._[0], username: "postgres", password: "postgres" } }
  );

  console.info("Fetching system...");
  let system = await dm.get_system("test_system");
  console.info("System: ", system);
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

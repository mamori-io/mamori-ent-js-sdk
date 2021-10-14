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
import { System } from '../../dist/api';
import { ParsedArgs } from 'minimist';

let eg = async function (dm: DMService, _args: ParsedArgs) {
  let egSystem = new System("test_system") ;
  try {
    await egSystem.delete(dm);
    console.info("Delete system: ", egSystem);
  }
  catch (e) {
    console.info("Delete system: ", (e as Error).message);
  }

  egSystem.ofType("POSTGRESQL", 'postgres')
          .at("10.0.2.2", 5431)
          .credentials('postgres', 'postgres')
          .defaultDatabase('mamori')
          .withOptions("CONNECTION_PROPERTIES 'asasda=2;fdgdfgfd=3'");
  await egSystem.create(dm) ;

  console.info("Fetching system...");
  let data1 = await egSystem.get(dm);
  console.info("System: ", data1);
  
  egSystem.at("10.0.2.2", 5432)
  await egSystem.update(dm) ;

  console.info("Fetching system...");
  let data2 = await egSystem.get(dm);
  console.info("System: ", data2);
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

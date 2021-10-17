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
import { Datasource } from '../../dist/datasource';
import { ParsedArgs } from 'minimist';

let eg = async function (dm: DMService, _args: ParsedArgs) {
  let egSystem = new Datasource("test_system") ;
  try {
    await egSystem.delete(dm);
    console.info("Delete system: ", egSystem);
  }
  catch (e) {
    console.info("Delete system: ", (e as Error).message);
  }

  egSystem.ofType("POSTGRESQL", 'postgres')
          .at("10.1.1.209", 5432)
          .withCredentials('postgres', 'postgres')
          .withTempDatabase('mamori')
          .withDatabase('mamori')
          .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
  await egSystem.create(dm) ;
  console.info("Created system: ", egSystem);

  
  // Alternative
  try {
    await Datasource.build({name: "test2_system"}).delete(dm);
    console.info("Delete system: test2_system");
  }
  catch (e) {
    console.info("Delete system: ", (e as Error).message);
  }

  await Datasource.build({
       name: "test2_system", 
       type: "POSTGRESQL", 
       driver: "postgres", 
       host: "10.1.1.209", 
       port: 5432,
       user: "postgres",
       password: "postgres",
       tempDatabase: "mamori",
       database: "mamori",
       urlProperties: 'allowEncodingChanges=true;defaultNchar=true'
  }).create(dm) ;
  console.info("Created system: test2_system");
}

let rapt = new ExampleWrapper(eg, process.argv) ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

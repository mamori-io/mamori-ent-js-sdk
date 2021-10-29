/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { DMService } from '../dist/api';
import { Datasource } from '../dist/datasource';
import { Runnable } from '../dist/runnable' ;

class DatasourceExample extends Runnable {
  
  async run(api: DMService, _args: ParsedArgs): Promise<void> {
    let egSystem = new Datasource("test_system") ;
    try {
      await egSystem.delete(api);
      console.info("Delete system: ", egSystem.name);
    }
    catch (e) {
      console.info("Delete system ", egSystem.name, ": ", (e as Error).message);
    }

    egSystem.ofType("POSTGRESQL", 'postgres')
            .at("10.1.1.209", 5432)
            .withCredentials('postgres', 'postgres')
            .withDatabase('mamori')
            .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
    await egSystem.create(api) ;
    console.info("Created ", egSystem);

    await egSystem.addCredential(api, 'test_user', 'postgres', 'postgres') ;

    // Alternative
    try {
      await Datasource.build({name: "test2_system"}).delete(api);
      console.info("Delete system: test2_system");
    }
    catch (e) {
      console.info("Delete system test2_system: ", (e as Error).message);
    }

    await Datasource.build({
        name: "test2_system", 
        type: "POSTGRESQL", 
        driver: "postgres", 
        host: "10.1.1.209", 
        port: 5432,
        user: "postgres",
        password: "postgres",
        database: "mamori",
        urlProperties: 'allowEncodingChanges=true;defaultNchar=true'
    }).create(api) ;
    console.info("Created system: test2_system");
  }
}

new DatasourceExample().execute() ;

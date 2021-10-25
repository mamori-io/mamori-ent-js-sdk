/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ParsedArgs } from 'minimist';

import { Datasource } from '../dist/datasource';
import { DMService } from '../dist/api';
import { Runnable } from '../dist/runnable' ;

class ShowDatasourcesExample extends Runnable {
  
    async run(dm: DMService, _args: ParsedArgs): Promise<void> {
      console.info("Supported datasource types: ", await Datasource.getTypes(dm));
      console.info("");
      console.info("Configured database drivers: ", await Datasource.getDrivers(dm));
      console.info("");
      console.info("All datasources: ", await Datasource.getAll(dm));
    }
  }
  
  new ShowDatasourcesExample()
    .execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

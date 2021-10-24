/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { Runnable } from '../dist/runnable' ;
import { DMService } from '../dist/api';
import { ParsedArgs } from 'minimist';

let testUser  = "test_user" ;

class CreateUserExample extends Runnable {
  
  async run(dm: DMService, _args: ParsedArgs): Promise<void> {
    try {
      await dm.delete_user(testUser);
      console.info("Delete user: ", testUser);
    }
    catch (e) {
      console.info("Delete user: ", (e as Error).message);
    }

    console.info("Creating test user...");
    await dm.create_user({
      username: testUser,
      password: "test",
      fullname: "Test User",
      identified_by: "password",
      authenticated_by_primary: {provider: "totp"},
      email: "test@test.test",
      valid_from: "2021-06-10 09:00:00",
      valid_until: "2022-06-31 17:00:00",
      valid_timezone: "Australia/Melbourne"
    });
    console.info("User: ", testUser);
  }
}

new CreateUserExample().execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

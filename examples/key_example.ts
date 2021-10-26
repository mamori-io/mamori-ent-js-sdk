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
import { Key } from '../dist/key';
import { Runnable } from '../dist/runnable' ;

class KeyExample extends Runnable {
  
  async run(dm: DMService, _args: ParsedArgs): Promise<void> {
    console.info("All keys: ", await Key.getAll(dm));

    // AES
    let aesKey = new Key("test_aes") ;
    try {
      await aesKey.delete(dm);
      console.info("Delete key: ", aesKey);
    }
    catch (e) {
      console.info("Delete key: ", aesKey, (e as Error).message);
    }
    aesKey.ofType('AES')
            .withKey('JaNdRgUjXn2r5u8x/A?D(G+KbPeShVmY');
    await aesKey.create(dm) ;
    console.info("Created key: ", aesKey);
    
    // RSA
    try {
      await Key.build({name: "test_rsa_public"}).delete(dm);
      console.info("Delete key: test_rsa_public");
    }
    catch (e) {
      console.info("Delete key: test_rsa_public", (e as Error).message);
    }
    try {
      await Key.build({name: "test_rsa_private"}).delete(dm);
      console.info("Delete key: test_rsa_private");
    }
    catch (e) {
      console.info("Delete key: test_rsa_private", (e as Error).message);
    }
    await Key.build({name: "test_rsa", type: 'RSA', size: 2048}).create(dm) ;
    console.info("Created key pair: test_rsa");

    // SSH
    let sshKey = new Key("test_ssh") ;
    try {
      await sshKey.delete(dm);
      console.info("Delete key: ", sshKey);
    }
    catch (e) {
      console.info("Delete key: ", sshKey, (e as Error).message);
    }
    sshKey.ofType('SSH')
          .withKey(
'-----BEGIN OPENSSH PRIVATE KEY-----\n' +
'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\n' +
'-----END OPENSSH PRIVATE KEY-----'
          );
    await sshKey.create(dm) ;
    console.info("Created key: ", sshKey);
    
    console.info("All keys: ", await Key.getAll(dm));
  }
}

new KeyExample().execute() ;

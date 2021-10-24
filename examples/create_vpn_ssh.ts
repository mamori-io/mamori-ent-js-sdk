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
import { Key } from '../dist/key';
import { SshTunnel } from '../dist/network';
import { ParsedArgs } from 'minimist';
import * as fs from "fs";
import { promisify } from "util";

let usage =
"Usage:\n" + 
"   yarn ts-node <example script> [--help] [--url url] [user password] vpnName [-i identity_file] [-n key_name] -L localPort:remoteHost:remotePort user@ssh_server\n" + 
"where:\n" + 
"   user\t\tmamori server user\n" +
"   password\n" +
"   url\t\tDefault: localhost:443\n" + 
"\n" + 
"   vpnName\tVPN name. This is limited to lowercase aplhanumeric characters, '-' and '.'.\n" + 
"   identity_file\tFile containing the private key\n" + 
"   key_name\tName of an existing SSH key, or of the key to be created from the identity_file. Default: <vpnName>_tunnel\n" + 
"   ssh_server\tThe remote SSH server IP address\n" + 
"   user\t\tSpecifies the user to log in as on the remote machine\n" + 
"   localPort\tThe local machine port \n" + 
"   remoteHost\tThe IP or hostname of the destination machine\n" + 
"   remotePort\tThe port of the destination machine" ;

class VpnSshExample extends Runnable {
  
  constructor() {
    super(usage, {
      string: ['url', '-i', '-n', '-L'],
      alias: { h: 'help' },
      default: { url: 'localhost:443' },
      '--': true,
    }) ;
  }

  async run(dm: DMService, args: ParsedArgs): Promise<void> {
    let vpnName = args._[2] ;

    let keyFile = args.i ;
    let keyName = args.n || vpnName + '_tunnel' ;
  
    let forwardArgs: string[] = args.L.split(':') ;
    let localPort  = forwardArgs[0] as unknown as number  ;
    let remoteHost = forwardArgs[1] ;
    let remotePort = forwardArgs[2] as unknown as number ;
  
    let sshsrv: string[] = args._[3].split('@') ;
    let user   = sshsrv[0] ;
    let server = sshsrv[1] ;
  
    console.info(`VPN: ${vpnName} -i ${keyFile} -n ${keyName} -L ${localPort}:${remoteHost}:${remotePort} ${user}@${server}`);
  
    let tunnel = new SshTunnel(vpnName) ;
    try {
      await tunnel.delete(dm) ;
      console.info("Deleted SSH tunnel: ", tunnel.name);
    }
    catch (e) {
      console.info("Delete SSH tunnel: ", (e as Error).message);
    }
  
    if (keyFile) {
      let key = new Key(keyName);
      try {
        await key.delete(dm) ;
        console.info("Deleted Key: ", key.name);
      }
      catch (e) {
        console.info("Delete key: ", (e as Error).message);
      }
  
      let privateKey: string = await promisify(fs.readFile)(keyFile, { encoding: "UTF-8" }) ;
      await key.withKey(privateKey)
               .create(dm) ;
    }
  
    await tunnel.at(server, 22)
                .withCredentials(user, keyName)
                .forward(localPort, remoteHost, remotePort)
                .create(dm) ;
    console.info("Created SSH tunnel: ", tunnel.name);
  
    console.info(tunnel.name, ': ', await tunnel.start(dm));
    let status = await tunnel.status(dm) ;
    console.info("SSH tunnel after start: ", tunnel.name, " status: ", status[0].Status);
    console.info(tunnel.name, ': ', await tunnel.stop(dm));
    console.info("SSH tunnel after stop: ", tunnel.name, " status: ", status[0].Status);
  }
}

new VpnSshExample()
  .execute()
  .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
  .finally(() => process.exit(0));

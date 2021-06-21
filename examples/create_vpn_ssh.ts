/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { ExampleWrapper } from './example_wrapper' ;
import { DMService } from '../dist/api';
import { ParsedArgs } from 'minimist';

let usage: string =       
"Usage:\n" + 
"   yarn ts-node <example script> [--help] [--url <url>] [<user> <password>] vpnName -L local_port:desination:desination_port user@ssh_server\n" + 
"where:\n" + 
"   user\t\tmamori server user\n" +
"   password\n" +
"   url\t\tDefault: localhost:443\n" + 
"   vpnName\t\tVPN name\n" + 
"   ssh_server\tThe remote SSH server IP address\n" + 
"   user\t\tSpecifies the user to log in as on the remote machine\n" + 
"   local_port\tThe local machine port \n" + 
"   desination\tThe IP or hostname of the destination machine\n" + 
"   desination_port\tThe port of the destination machine" ;

let eg = async function (dm: DMService, args: ParsedArgs) {
  let vpnName = args._[2] ;

  let sshsrv: string[] = args._[3].split('@') ;
  let user = sshsrv[0] ;
  let server = sshsrv[1] ;

  let tunnel: string[] = args.L.split(':') ;
  let local_port = tunnel[0] ;
  let destination = tunnel[1] ;
  let destination_port = tunnel[2] ;

  console.info(`VPN: ${vpnName} -L ${local_port}:${destination}:${destination_port} ${user}@${server}`);

  try {
    await dm.destroy_vpn_connection(vpnName) 
    console.info("Delete VPN: ", vpnName);
  }
  catch (e) {
    console.info("Delete VPN: ", (e as Error).message);
  }

  await dm.create_vpn_connection({
    name: vpnName, 
    type: "ssh", 
    config: {host: server, port: 22, username: user, localPort: local_port, remoteHost:destination, remotePort: destination_port},
    secrets: {privateKey: "", publicKey: ""}
  });
}

let rapt = new ExampleWrapper(eg, process.argv, {
  string: ['url', '-L'],
  alias: { h: 'help' },
  default: { url: 'localhost:443' },
  '--': true,
}) ;
rapt.usage = usage ;
rapt.execute()
    .catch((e: any) => console.error("ERROR: ", e.response == undefined ? e : e.response.data))
    .finally(() => process.exit(0));

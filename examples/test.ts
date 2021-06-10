
// allow for self signed certs
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { DMService } from '../src/api';

let argv = require('minimist')(process.argv.slice(2)) ;
argv.url = argv.url || 'localhost:443';
console.log(argv);

let dm = new DMService("https://" + argv.url + "/");

async function test() {
    console.info("server status:", await dm.service_status());

    console.info("Connecting...");
    let login = await dm.login(argv._[0], argv._[1]);
    console.info("login successful:", login);
    console.info("ping", await dm.ping());


    console.info("fetching connection totals for the last hour...");
    let now = new Date();
    let then = new Date(now.getTime() - 1000 * 3600); // 1 hour ago

    let from_date = then.toISOString().replace("T", " ").replace(/\..*$/, "");
    let to_date = now.toISOString().replace("T", " ").replace(/\..*$/, "");
    console.info("totals:", await dm.call_operation("connection_totals", {from_date: from_date, to_date: to_date}));

    console.info("Fetching server version...");
    console.info("Version:", await dm.simple_query("select * from  SYS.SYSVERSION"));

    console.info("Fetching SSH logins...");
    console.info("SSH logins:", await dm.ssh_logins());
}


test().catch(e => console.error("ERROR:", e)).finally(() => process.exit(0));

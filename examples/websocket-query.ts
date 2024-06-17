process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { MamoriWebsocketClient, io_https } from '../src/api';

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {
    let api = new MamoriWebsocketClient();
    console.info("Connecting...");
    let client = await api.connect(mamoriUrl.replace(/^http/, "ws") + "/websockets/query", mamoriUser, mamoriPwd);

    try {
        console.info("Login successful");

        let counter = 0;
        for await (const row of client.select("select * from SYS.QUERIES")) {
            console.info(row);
            counter++;
        }

        console.info("Fetched %o rows", counter);
    } finally {
        client.disconnect()
    }
}

example()
    .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

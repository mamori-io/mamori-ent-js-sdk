import { DMService } from '../dist/api';
import * as https from 'https';

let argv = require('minimist')(process.argv.slice(2));
argv.url = argv.url || 'localhost:443';
console.log(argv);

const INSECURE = new https.Agent({ rejectUnauthorized: false });
let dm = new DMService("https://" + argv.url + "/", INSECURE);

async function create_datasource() {
  console.info("Connecting...");
  let login = await dm.login(argv._[0], argv._[1]);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  try {
    let dsystem = await dm.delete_system("test_system") ;
    console.info("Delete system: ", dsystem);
  }
  catch (e) {
    console.info("Delete system: ", (e as Error).message);
  }

  await dm.create_system_for_rec("N",
    { name: "test_system", type: "POSTGRESQL", host: "10.0.2.2" },
    "PORT '5432', DRIVER 'postgres', USER 'postgres', PASSWORD 'postgres', DEFAULTDATABASE 'mamori', TEMPDATABASE 'mamori'",
    { a: { system_name: "test_system", cirro_user: argv._[0], username: "postgres", password: "postgres" } }
  );

  console.info("Fetching system...");
  let system = await dm.get_system("test_system");
  console.info("System: ", system);
}

create_datasource().catch(e => console.error("ERROR: ", e)).finally(() => process.exit(0));

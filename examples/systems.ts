import { DMService } from '../src/api';
import * as https from 'https';

const INSECURE = new https.Agent({rejectUnauthorized: false});
let dm = new DMService("https://localhost/", INSECURE);

async function display_systems() {
  console.info("server status:", await dm.service_status());

  console.info("Connecting...");
  let login = await dm.login("root", "test");
  console.info("login successful:", login);

  console.info("Fetching user systems...");
  let systems = await dm.user_systems();
  console.info("user systems:", systems);
}

display_systems().catch(e => console.error("ERROR:", e)).finally(() => process.exit(0));

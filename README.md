MAMORI.IO V1 API BINDINGS
==================================

INSTALLATION
```sh
yarn add mamori-io-v1-api
yarn add ts-node
yarn add typescript
yarn add @types/node
```

TO RUN A SCRIPT
```sh
yarn ts-node <your script>
```


EXAMPLE - Login and list available datasources
```js
// allow for self signed certs
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { DMService } from '../src/api';

let dm = new DMService("https://localhost/");

async function display_systems() {
  console.info("server status:", await dm.service_status());

  console.info("Connecting...");
  let login = await dm.login("root", "test");
  console.info("login successful:", login);

  console.info("Fetching user systems...");
  let systems = await dm.user_systems();
  console.info("user systems:", systems);
}


display_systems().finally(() => process.exit(0));

```

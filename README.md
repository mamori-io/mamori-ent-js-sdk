# SDK for Mamori enterprise server and proxies

## Installation
```sh
yarn add mamori-ent-js-api
yarn add ts-node
yarn add typescript
yarn add typedoc
yarn add @types/node
yarn add @types/minimist
```

## Usage
To run a script:
```sh
yarn ts-node --transpile-only <your script>
```

Example script: login and list available datasources
```js
// allow for self-signed certificates
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { DMService } from 'mamori-ent-js-api';

let mamoriUrl  = "https://localhost/" ;
let mamoriUser = "alice" ;
let mamoriPwd  = "mirror" ;

let dm = new DMService(mamoriUrl);

async function display_systems() {
  console.info("Connecting...");
  let login = await dm.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  console.info("Fetching user systems...");
  let systems = await dm.user_systems();
  console.info("User systems: ", systems);
}

display_systems().catch(e => console.error("ERROR: ", e)).finally(() => process.exit(0));
```

For more examples, see `./examples/`.

## Documentation
To generate, execute `./generate_docs.sh` and open `./docs/index.html` to view.

See [mamori.io](https://mamori.io/resources.html) for further documentation.

----
Copyright (c) 2021 mamori.io

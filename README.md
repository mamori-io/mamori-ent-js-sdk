# SDK for Mamori enterprise server and proxies

## Installation
```sh
yarn add mamori-ent-js-sdk
yarn add ts-node
yarn add typescript
yarn add @types/node
```

## Usage
To run a script:
```sh
yarn ts-node <your script>
```

## Examples
To see and run examples:
```sh
//List Examples
ls -l node_modules/mamori-ent-js-sdk/examples

//To run an example you must copy it to the base directory
cp node_modules/mamori-ent-js-sdk/examples/secret.ts .
```


Example script: login and list available datasources
```js
// allow for self-signed certificates
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { MamoriService,io_datasource } from 'mamori-ent-js-sdk';

let mamoriUrl  = "https://localhost/" ;
let mamoriUser = "alice" ;
let mamoriPwd  = "mirror" ;

let dm = new MamoriService(mamoriUrl);

async function display_datasources() {
  let api = new MamoriService(mamoriUrl);

  console.info("Connecting...");
  let login = await api.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  console.info("Fetching user datasources...");
  let datasources = await io_datasource.Datasource.getAll(api);
  console.info("User datasources: ", datasources);
}

display_datasources()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));
```

For more examples, see `./examples/`.

For several useful one-task scripts, see `./scripts/`.

## Documentation
To generate, execute `./generate_docs.sh` and open `./docs/index.html` to view.

See [mamori.io](https://mamori.io/resources.html) for further documentation.

----
Copyright (c) 2021 mamori.io

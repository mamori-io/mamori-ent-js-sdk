# SDK for Mamori enterprise server and proxies

## Installation
```sh
yarn add mamori-ent-js-sdk
yarn add ts-node
yarn add typescript
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
import { Datasource } from 'mamori-ent-js-api';

let mamoriUrl  = "https://localhost/" ;
let mamoriUser = "alice" ;
let mamoriPwd  = "mirror" ;

let dm = new DMService(mamoriUrl);

async function display_datasources() {
  let api = new DMService(mamoriUrl);

  console.info("Connecting...");
  let login = await api.login(mamoriUser, mamoriPwd);
  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

  console.info("Fetching user datasources...");
  let datasources = await Datasource.getAll(api);
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

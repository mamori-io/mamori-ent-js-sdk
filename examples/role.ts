process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils, io_user} from 'mamori-ent-js-sdk';
import { ignoreError } from 'mamori-ent-js-sdk';
import { Role } from 'mamori-ent-js-sdk';

const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
const host = process.env.MAMORI_SERVER || '';

async function example() {
    let api = new MamoriService(host, INSECURE);
		console.info("Connecting...");
	  let login = await api.login(mamoriUser, mamoriPwd);
	  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
    let apiAsAPIUser: MamoriService;

    /////////////////////////
    // CREATE ROLE TO GRANTEE
    let grantee = "example_roles_user.";
    let granteepw = "J{J'vpKs!$nW6(6A,4!98712_vdQ'}D";

    await ignoreError(api.delete_user(grantee));
    await api.create_user({
      username: grantee,
      password: granteepw,
      fullname: grantee,
      identified_by: "password",
      email: "test@test.test"
    })
    apiAsAPIUser = new MamoriService(host, INSECURE);
    await apiAsAPIUser.login(grantee, granteepw);
    
    ///////////////
    //CONFIGURE IT
    let name: string = "example_automated_role";
    let r = new Role(name);

    /////////////
    // CREATE IT
    await io_utils.noThrow(r.create(api));
    console.info("creating role...%s", name);
    ///////////
    //READ IT
    (await io_utils.noThrow(Role.getAll(api))).filter((o: any) => o.roleid == r.roleid);
    console.info("reading role...%s", name);

    ///////////
    //GRANT IT
    (await io_utils.noThrow(r.getGrantees(apiAsAPIUser)));
    console.info("granting role...%s", name);
    ///////////
    //DELETE IT
    await io_utils.noThrow(r.delete(api));
    console.info("deleting role...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

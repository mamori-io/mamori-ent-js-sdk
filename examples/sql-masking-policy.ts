process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils, io_user, Role} from '../src/api';
import { User } from '../src/user';
import { SQLMaskingPolicy } from '../src/sql-masking-policy';
import { PolicyPermission } from '../src/permission';

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {
    let api = new MamoriService(mamoriUrl);
		console.info("Connecting...");
	  let login = await api.login(mamoriUser, mamoriPwd);
	  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

    //////////////
    //CREATE ADMIN AND POLICY TO GRANTEE
    let grantee = "example_sql-masking_user.";
    let granteepw = "J{J'vpKs!$nas!23(6A,4!98712_vdQ'}D";
    let admin = "example_sql-masking_admin.";
    let adminpw = "J{J'vpKs!$sadmins!23(6A,12_vdQ'}D";

    let adminU = new User(admin).withEmail("userexample@ace.com").withFullName("Policy User");
    await io_utils.noThrow(adminU.create(api, adminpw));
    let policyU = new User(grantee).withEmail("userexample@ace.com").withFullName("Policy User");
    await io_utils.noThrow(policyU.create(api, granteepw));


    ///////////////
    //CONFIGURE IT
    let name = "example_sql-masking.policy._";
    let s = new SQLMaskingPolicy(name);
    s.priority = 100;

    /////////////
    // CREATE IT
    await io_utils.noThrow(s.create(api));
    console.info("creating ...%s", name);

    ///////////
    //READ IT
    await io_utils.noThrow(io_user.User.get(api, name));
    console.info("reading sql-masking-policy.ts...%s", name);

    let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, "POLICY"],
    ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee],
    ["policy", io_utils.FILTER_OPERATION.EQUALS_STRING, name]];
    await new PolicyPermission().grantee(grantee).list(api, filter)

    //////////
    //GRANT IT
    await io_utils.noThrow(s.grantTo(api, grantee));

    ///////////
    //DELETE IT
    await io_utils.noThrow(s.delete(api));
    console.info("deleting sql-masking-policy.ts...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

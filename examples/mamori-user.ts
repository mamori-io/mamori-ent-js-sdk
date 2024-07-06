process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { MamoriService,io_https, io_utils, io_user} from 'mamori-ent-js-sdk';

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';


//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;
   
async function example() {
    let api = new MamoriService(mamoriUrl);
		console.info("Connecting...");
	  let login = await api.login(mamoriUser, mamoriPwd);
	  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
    ///////////////
    //CONFIGURE IT
    let name: string = "example_mamori_user";
    let m = new io_user.User(name).withEmail(name + "@ace.com").withFullName("Example User");
    /////////////
    // CREATE IT
    await io_utils.noThrow(m.create(api));
    console.info("creating mamori_user...%s", name);
    ///////////
    //READ IT
    await io_utils.noThrow(io_user.User.get(api, name));
    console.info("reading mamori_user...%s", name);
    ///////////
    //DELETE IT
    await io_utils.noThrow(m.delete(api));
    console.info("deleting mamori_user...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { MamoriService,io_https, io_utils, io_remotedesktop } from 'mamori-ent-js-sdk';


const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
const host = process.env.MAMORI_SERVER || '';

function fail(reason = "fail was called in a test.") {
  throw new Error(reason);
}

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {
    let api = new MamoriService(host, INSECURE);
    let apiAsAPIUser: MamoriService;
		console.info("Connecting...");
	  let login = await api.login(mamoriUser, mamoriPwd);
	  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
   


    /////////////////////////
    // CREATE GRANTEE
    let grantee = "example_apiuser_rmdlogin";
    let granteepw = "J{J'vpKs!$nW6(6A,4!3#$4#12_vdQ'}D";
    
    await io_utils.ignoreError(api.delete_user(grantee));
    await api.create_user({
          username: grantee,
          password: granteepw,
          fullname: grantee,
          identified_by: "password",
          email: "example@example.example"
        }).catch(e => {
            fail(io_utils.handleAPIException(e));
        })
    apiAsAPIUser = new MamoriService(host, INSECURE);
    await apiAsAPIUser.login(grantee, granteepw);

    ///////////////
    //CONFIGURE IT
    let name: string = "example_remote_desktop_login";
    let r = new io_remotedesktop.RemoteDesktopLogin("test_rdp_login", io_remotedesktop.REMOTE_DESKTOP_PROTOCOL.RDP);
    r.at("host", "port").withLoginMode(io_remotedesktop.LOGIN_PROMPT_MODE.MAMORI_PROMPT);

    /////////////
    // CREATE IT
    let k = r.fromJSON(r.toJSON());
    await io_utils.noThrow(r.create(api));
    console.info("creating remote_desktop_login...%s", name);
    ///////////
    //READ IT
    await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.getByName(api, k.name));
    await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.getByName(api, k.name));
    await io_utils.noThrow(io_remotedesktop.RemoteDesktopLogin.list(apiAsAPIUser, 0, 10, [["name", "=", k.name]]));
    console.info("reading remote_desktop_login...%s", name);

    //////////
    //GRANT IT
    await io_utils.noThrow(k.grantTo(api, grantee));

    ///////////
    //DELETE IT
    await io_utils.noThrow(r.delete(api));
    console.info("deleting remote_desktop_login...%s", name);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

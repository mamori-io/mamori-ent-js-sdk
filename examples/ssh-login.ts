process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from 'mamori-ent-js-sdk';
import { io_key, SshLogin, sshKeyName } from 'mamori-ent-js-sdk';

const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const host = process.env.MAMORI_SERVER || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;   
    
async function example() {
    let api = new MamoriService(host, INSECURE);
    let apiAsAPIUser: MamoriService;
		console.info("Connecting...");
	  let login = await api.login(mamoriUser, mamoriPwd);
	  console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

    /////////////////
    //CREATE GRANTEE
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

    /////////////////
    //CREATE SSH KEY
    let x = await new io_key.Key(sshKeyName).ofType(io_key.KEY_TYPE.SSH).withAlgorithm(io_key.SSH_ALGORITHM.RSA).ofSize(1024).create(api);
    expect(x).toContain("ssh-rsa");

    ///////////////
    //CONFIGURE IT
    let s = new SshLogin("example_ssh_login_to_local");
    await io_utils.ignoreError(s.delete(api));

    /////////////
    // CREATE IT
    s.at("local host", "22");
    s.withKeyCredentials("root", sshKeyName);

    s = s.fromJSON(s.fromJSON())
    await io_utils.noThrow(s.create(api));
    console.info("creating ssh_login_to_local...%s", s);

    ///////////
    //READ IT
    (await io_utils.noThrow(SshLogin.getAll(api))).filter((o: any) => o.s == s.s)[0];
    console.info("reading ssh_login_to_local...%s", s);

    ////////////////////////////////////
    //ENSURE NON-ADMINS CANNOT SEE ROWS
    (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((o: any) => o.name == s.name);

    ///////////
    //GRANT IT 
    await io_utils.noThrow(s.grantTo(api, grantee));

    ///////////////////////////////
    //ENSURE USER CAN'T DELETE KEY
    await io_utils.ignoreError(s.delete(apiAsAPIUser));

    ////////////
    //REVOKE KEY
    await io_utils.noThrow(s.revokeFrom(api. grantee));
    (await io_utils.noThrow(SshLogin.getAll(apiAsAPIUser))).filter((key: any) => key.name == s.name);

    ///////////
    //DELETE IT
    await io_utils.noThrow(s.delete(api));
    console.info("deleting ssh_login_to_local...%s", s);
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

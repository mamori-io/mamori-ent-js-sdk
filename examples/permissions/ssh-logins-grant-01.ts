import { MamoriService } from '../../dist/api';
import { SSHLoginPermission, TIME_UNIT } from '../../dist/permission';
import * as https from 'https';

let mamoriUrl = process.env.MAMORI_SERVER || '';
let mamoriUser = process.env.MAMORI_USERNAME || '';
let mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

async function GrantSSHLogin(sshlogin: string, grantee: string) {
    let api = new MamoriService(mamoriUrl, INSECURE);
    console.info("Connecting to %s...", mamoriUrl);
    let login = await api.login(mamoriUser, mamoriPwd);
    console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);


    await new SSHLoginPermission()
        .sshLogin(sshlogin)
        .grantee(grantee)
        .grant(api);
    let filter = {
        "0": ["permissiontype", FILTER_OPERATION.EQUALS_STRING, "SSH"],
        "1": ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        "3": ["key_name", FILTER_OPERATION.EQUALS_STRING, sshlogin]
    };
    let res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
    console.log(res);
}

GrantSSHLogin("myssh", "apiuser1")
    .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));
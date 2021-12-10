
import { MamoriService } from '../../dist/api';
import { SSHLoginPermission } from '../../dist/permission';
import * as https from 'https';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

let mamoriUrl = process.env.MAMORI_SERVER || '';
let mamoriUser = process.env.MAMORI_USERNAME || '';
let mamoriPwd = process.env.MAMORI_PASSWORD || '';

async function RevokeSSHLogin(sshlogin: string, grantee: string) {
    let api = new MamoriService(mamoriUrl, INSECURE);
    console.info("Connecting to %s...", mamoriUrl);
    let login = await api.login(mamoriUser, mamoriPwd);
    console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
    //Revoke permission
    await new SSHLoginPermission()
        .sshLogin(sshlogin)
        .grantee(grantee)
        .all(true)
        .revoke(api);
    //Query permissions
    let filter = ["permissiontype", "=", "SSH"];
    let res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
    console.log(res);
}


RevokeSSHLogin("YOUR_SSH_LOGIN", "SOME_USER_OR_ROLE")
    .catch(e => console.error("ERROR: ", e.response.data))
    .finally(() => process.exit(0));

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
        .withValidBetween("2021-12-01 00:00", "2021-12-20 00:00")
        .grant(api);
    //Add ssh login permission with properties
    await new SSHLoginPermission()
        .fromJSON({
            recipient: grantee,
            validType: 'for',
            validFrom: '',
            validUntil: '',
            validForDuration: 300,
            validForUnit: TIME_UNIT.MINUTES,
            grantable: false,
            permissions: "SSH",
            sshLoginName: sshlogin
        })
        .grant(api);

    let filter = ["permissiontype", "=", "SSH"];
    let res = await new SSHLoginPermission().grantee(grantee).list(api, filter);
    console.log(res);


}

GrantSSHLogin("YOUR_SSH_LOGIN", "SOME_USER_OR_ROLE")
    .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));
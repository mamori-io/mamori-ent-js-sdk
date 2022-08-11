import { MamoriService } from '../../api';
import * as https from 'https';
import { Datasource } from '../../datasource';
import { handleAPIException, noThrow, ignoreError, FILTER_OPERATION } from '../../utils';
import { DatasourcePermission, DB_PERMISSION } from '../../permission';
import { ServerSession } from '../../server-session';

const SOCKET_OPTIONS = { rejectUnauthorized: false };
const INSECURE = new https.Agent(SOCKET_OPTIONS);

export async function setPassthroughPermissions(api: MamoriService, grantee: string, dsName: string) {
    let r2 = await noThrow(new DatasourcePermission().on(dsName, "", "", "").permission(DB_PERMISSION.MASKED).grantee(grantee).grant(api));
    expect(r2.errors).toBe(false);
    let r3 = await noThrow(new DatasourcePermission().on(dsName, "*", "*", "*").permission(DB_PERMISSION.SELECT).grantee(grantee).grant(api));
    expect(r3.errors).toBe(false);
}


export async function createNewPassthroughSession(host: string, username: string, password: string, datasourceName: string): Promise<MamoriService> {
    //CREATE NEW SESSION AND SET TO PASSTHROUGH
    let apiU = new MamoriService(host, INSECURE, SOCKET_OPTIONS);
    let r1 = await noThrow(apiU.login(username, password));
    //console.log("**** %o", r1);
    expect(r1.login_token).toBeDefined();
    let r4 = await noThrow(ServerSession.setPassthrough(apiU, datasourceName));
    expect(r4.errors).toBe(false);
    return apiU;
}

export async function createPGDatabaseUser(api: MamoriService, username: string, password: string, database: string) {
    await dropPGDatabaseUser(api, username, database);
    let x1 = await noThrow(api.simple_query("CREATE USER " + username + " LOGIN PASSWORD '" + password + "'"));
    // console.log("CREATE USER %s %s %o", username, password, x1);
    expect(x1.errors).toBeUndefined();
    let x2 = await noThrow(api.simple_query("GRANT ALL PRIVILEGES ON DATABASE " + database + " TO " + username + ""));
    expect(x2.errors).toBeUndefined();
}

export async function dropPGDatabaseUser(api: MamoriService, username: string, database: string) {
    let x2 = await ignoreError(api.simple_query("REVOKE ALL PRIVILEGES ON DATABASE " + database + " FROM " + username + ""));
    //expect(x2.errors).toBeUndefined();
    let x1 = await ignoreError(api.simple_query("DROP USER " + username));
    //expect(x1.errors).toBeUndefined();
}

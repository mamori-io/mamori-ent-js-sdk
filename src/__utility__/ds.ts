import { MamoriService } from '../api';
import * as https from 'https';
import { io_utils, io_permission } from '../api';
import { ServerSession } from '../server-session';

const SOCKET_OPTIONS = { rejectUnauthorized: false };
const INSECURE = new https.Agent(SOCKET_OPTIONS);

export async function setPassthroughPermissions(api: MamoriService, grantee: string, dsName: string) {
    let r2 = await io_utils.noThrow(new io_permission.DatasourcePermission().on(dsName, "", "", "").permission(io_permission.DB_PERMISSION.MASKED).grantee(grantee).grant(api));
    expect(r2.errors).toBe(false);
    let r3 = await io_utils.noThrow(new io_permission.DatasourcePermission().on(dsName, "*", "*", "*").permission(io_permission.DB_PERMISSION.SELECT).grantee(grantee).grant(api));
    expect(r3.errors).toBe(false);
}


export async function createNewPassthroughSession(host: string, username: string, password: string, datasourceName: string): Promise<MamoriService> {
    //CREATE NEW SESSION AND SET TO PASSTHROUGH
    let apiU = new MamoriService(host, INSECURE, SOCKET_OPTIONS);
    let r1 = await io_utils.noThrow(apiU.login(username, password));
    //console.log("**** %o", r1);
    expect(r1.login_token).toBeDefined();
    let r4 = await io_utils.noThrow(ServerSession.setPassthrough(apiU, datasourceName));
    expect(r4.errors).toBe(false);
    return apiU;
}

export async function createPGDatabaseUser(api: MamoriService, username: string, password: string, database: string) {
    await dropPGDatabaseUser(api, username, database);
    let x1 = await io_utils.noThrow(api.select("CREATE USER " + username + " LOGIN PASSWORD '" + password + "'"));
    // console.log("CREATE USER %s %s %o", username, password, x1);
    expect(x1.errors).toBeUndefined();
    let x2 = await io_utils.noThrow(api.select("GRANT ALL PRIVILEGES ON DATABASE " + database + " TO " + username + ""));
    expect(x2.errors).toBeUndefined();
}

export async function dropPGDatabaseUser(api: MamoriService, username: string, database: string) {
    let x2 = await io_utils.ignoreError(api.select("REVOKE ALL PRIVILEGES ON DATABASE " + database + " FROM " + username + ""));
    //expect(x2.errors).toBeUndefined();
    let x1 = await io_utils.ignoreError(api.select("DROP USER " + username));
    //expect(x1.errors).toBeUndefined();
}

import { Datasource, MamoriService, MamoriWebsocketClient } from '../api';
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


export async function createPGDatabaseUser(api: MamoriWebsocketClient, username: string, password: string, database: string) {
    await dropPGDatabaseUser(api, username, database);
    let x1 = await (api.query("CREATE USER " + username + " LOGIN PASSWORD '" + password + "'"));
    //console.log("CREATE USER %s %s %o", username, password, x1);
    expect(x1.errors).toBeUndefined();
    let x2 = await io_utils.noThrow(api.query("GRANT ALL PRIVILEGES ON DATABASE " + database + " TO " + username + ""));
    expect(x2.errors).toBeUndefined();
}

export async function dropPGDatabaseUser(api: MamoriWebsocketClient, username: string, database: string) {
    let x2 = await io_utils.ignoreError(api.query("REVOKE ALL PRIVILEGES ON DATABASE " + database + " FROM " + username + ""));
    //expect(x2.errors).toBeUndefined();
    let x1 = await io_utils.ignoreError(api.query("DROP USER " + username));
    //expect(x1.errors).toBeUndefined();
}

export async function createOracleDatabaseUser(api: MamoriService, username: string, password: string) {
    await dropOracleDatabaseUser(api, username);
    let statements = [];
    statements.push("CREATE USER "+username+" IDENTIFIED BY "+password);
    statements.push("ALTER USER "+username+" quota unlimited on users");
    statements.push("grant dba to "+username);
    for (let sql of statements){
        let x1 = await io_utils.noThrow(api.select(sql));
        expect(x1.errors).toBeUndefined();
    }
}

export async function dropOracleDatabaseUser(api: MamoriService, username: string) {
    let x1 = await io_utils.ignoreError(api.select("DROP USER " + username+" CASCADE" ));
}

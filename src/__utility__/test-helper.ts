import { assert } from "console";
import { io_permission, io_serversession, io_sqlmaskingpolicies, MamoriService, io_role, io_ondemandpolicies, io_key } from "../api";
import { io_utils, io_https } from "../api";

const childProcess = require("child_process");

/**
 * @param {string} command A shell command to execute
 * @return {Promise<string>} A promise that resolve to the output of the shell command, or an error
 * @example const output = await execute("ls -alh");
 */
export function execute(command: string): Promise<string> {
  /**
   * @param {Function} resolve A function that resolves the promise
   * @param {Function} reject A function that fails the promise
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
   */
    return new Promise(function(resolve: any, reject: any) {
    /**
     * @param {Error} error An error triggered during the execution of the childProcess.exec command
     * @param {string|Buffer} standardOutput The result of the shell command execution
     * @param {string|Buffer} standardError The error resulting of the shell command execution
     * @see https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
     */
	childProcess.exec(command, function(error: any, standardOutput: any, standardError: any) {
	    if (error) {
		reject(error);

		return;
	    }

	    resolve(standardOutput);
	});
  });
}


export function sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export class DBHelper {


    static dateRange() {
        let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let dt = new Date();
        // get UTC date america/u/
        let year = dt.getFullYear();
        let month = (dt.getMonth() + 1).toString().padStart(2, '0');
        let day = dt.getDate().toString().padStart(2, '0');
        let today = year + "-" + month + "-" + day;
        let fromD = today + " 00:00";
        let toD = today + " 23:59:59";

        return {
            fromD: fromD,
            fromDtz: fromD + " " + tz,
            toD: toD,
            toDtz: toD + " " + tz,
            tz: tz,
        }
    }


    static async runSQLStatements(api: MamoriService, statements: any[]): Promise<any> {
        let res: any = {};
        let ndx = 1;
        for (let sql of statements) {
            let o = await io_utils.noThrow(api.select(sql));
            res["query_" + ndx] = o;
            res["query_" + ndx].sql = sql;
            ndx++;
        }
        return res;
    }

    static async preparePassthroughSession(host: string, username: string, password: string, datasource: string): Promise<MamoriService> {
        let INSECURE = new io_https.Agent({ rejectUnauthorized: false })
        let apiAsAdmin = new MamoriService(host, INSECURE);
        await apiAsAdmin.login(username, password);
        let setPassthroughSession = await io_utils.noThrow(io_serversession.ServerSession.setPassthrough(apiAsAdmin, datasource));
        if (setPassthroughSession.errors) {
            await apiAsAdmin.logout();
            // it is done this way so we can see the error in the output
            //console.log("***** Passthrough Initiating - user:%s datasource:%s", username, datasource);
            expect(setPassthroughSession).toBe({});
        } else {
            // console.log("***** Passthrough OK - user:%s datasource:%s", username, datasource);
        }
        return apiAsAdmin;
    }

    static async prepareOracleObjects(api: MamoriService, schemaName: string) {
        let statements = ["alter session set \"_ORACLE_SCRIPT\"=true"
            , "DROP USER " + schemaName + "01 CASCADE"
            , "CREATE USER  " + schemaName + "01 identified by mamoritest6351"
            , "GRANT DBA TO " + schemaName + "01 "
            , "DROP USER " + schemaName + " CASCADE"
            , "DROP USER " + schemaName + " CASCADE"
            , "CREATE USER  " + schemaName + " no authentication "
            , "ALTER USER  " + schemaName + " quota unlimited on users"
            , "CREATE TABLE " + schemaName + ".TAB1 (col1 varchar2(50),col2 varchar2(50))"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value1','value21')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value2','value22')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value3','value23')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value4','value24')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value5','value25')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value6','value26')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value7','value27')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value8','value28')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value9','value29')"];
        return this.runSQLStatements(api, statements);
    }

    static async prepareSSObjects(api: MamoriService, schemaName: string) {
        let statements = ["DROP TABLE " + schemaName + ".TAB1"
            , "DROP SCHEMA " + schemaName
            , "CREATE SCHEMA " + schemaName
            , "CREATE TABLE " + schemaName + ".TAB1 (col1 varchar(50),col2 varchar(50))"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value1','value21')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value2','value22')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value3','value23')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value4','value24')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value5','value25')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value6','value26')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value7','value27')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value8','value28')"
            , "INSERT INTO " + schemaName + ".TAB1 (col1,col2) values ('value9','value29')"];
        return this.runSQLStatements(api, statements);
    }

    static async cleanUpSchemaSS(api: MamoriService, schemaName: string) {
        let statements = ["DROP TABLE " + schemaName + ".TAB1"
            , "DROP SCHEMA " + schemaName];
        let results = await this.runSQLStatements(api, statements);
    }

    static async cleanUpSchemaOracle(api: MamoriService, schemaName: string) {
        let statements = ["DROP USER " + schemaName + " CASCADE", "DROP USER " + schemaName + "01 CASCADE"];
        let results = await this.runSQLStatements(api, statements);
    }

    static async addMaskingPolicy(api: MamoriService, name: string, rules: any[]): Promise<io_sqlmaskingpolicies.SQLMaskingPolicy> {
        let o = new io_sqlmaskingpolicies.SQLMaskingPolicy(name);
        await io_utils.ignoreError(o.delete(api));
        let q7 = await io_utils.noThrow(o.create(api));
        expect(q7.errors).toBeUndefined();
        for (let rule of rules) {
            let q8 = await io_utils.noThrow(o.addColumnRule(api, rule.objecturi, rule.column, rule.mask));
            expect(q8.errors).toBe(false);
        }
        let q9 = await io_utils.noThrow(o.listColumnRules(api));
        expect(q9.totalCount).toBe(rules.length);
        return o;
    }




}

export class Policy {
    static async setupResourcePolicy(api: MamoriService, roleName: string, policyName: string): Promise<any> {
        await io_utils.ignoreError(new io_role.Role(roleName).delete(api));
        await io_utils.ignoreError(new io_role.Role(roleName).create(api));
        // POLICY
        let policy = new io_ondemandpolicies.OnDemandPolicy(policyName, io_ondemandpolicies.POLICY_TYPES.RESOURCE);
        policy.requires = roleName;
        policy.addParameter("time", "number of minutes", "15");
        policy.withScript(["GRANT :privileges ON :resource_name TO :applicant VALID for :time minutes;"]);
        await io_utils.noThrow(policy.delete(api));
        let r = await io_utils.noThrow(policy.create(api));
        if (r.error !== false) {
            // it is done like this so we can see the error
            expect(r).toBe({});
        }
        return policy;
    }
}

export class EncryptionKey {
    static async setupAESEncryptionKey(api: MamoriService, keyName: string) {
        let keyValue = '8x/A?D(G+KbPeShVkYp3s6v9y$B&E)H@';
        let k = new io_key.Key(keyName).ofType(io_key.KEY_TYPE.AES).withKey(keyValue);
        await io_utils.ignoreError(k.delete(api));
        let res = await io_utils.noThrow(k.create(api));
        expect(res.error).toBe(false);
    }

    static async cleanupAESEncryptionKey(api: MamoriService, keyName: string) {
        let keyValue = '8x/A?D(G+KbPeShVkYp3s6v9y$B&E)H@';
        let k = new io_key.Key(keyName).ofType(io_key.KEY_TYPE.AES).withKey(keyValue);
        await io_utils.ignoreError(k.delete(api));
    }


}

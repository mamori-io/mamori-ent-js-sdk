import { assert } from "console";
import { io_permission, io_serversession, io_sqlmaskingpolicies, MamoriService } from "../api";
import { io_utils, io_https } from "../api";


export class DBHelper {

    static async runSQLStatements(api: MamoriService, statements: any[]): Promise<any> {
        let res: any = {};
        let ndx = 1;
        for (let sql of statements) {
            let o = await io_utils.noThrow(api.simple_query(sql));
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
            expect(setPassthroughSession.errors).toBe(false);
        }
        return apiAsAdmin;
    }

    static async prepareOracleObjects(api: MamoriService, schemaName: string) {
        let statements = ["alter session set \"_ORACLE_SCRIPT\"=true"
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
        let statements = ["DROP USER " + schemaName + " CASCADE"];
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
        expect(q9.totalCount).toBe(rules.length.toString());
        return o;
    }

}

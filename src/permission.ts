/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */

import { MamoriService } from './api';
import { ISerializable } from "./i-serializable";


export enum PERMISSION_TYPE {
    MAMORI = "mamori",
    DATASOURCE = "datasource",
    POLICY = "policy",
    KEY = "encryptionkey",
    ROLE = "role",
    SSH = "ssh",
    REMOTE_DESKTOP = "remotedesktop",
    IP_RESOURCE = "ip_resource",
    HTTP_RESOURCE = "http_resource",
    SECRET = "secret"
}

export enum TIME_UNIT {
    SECONDS = "seconds",
    MINUTES = "minutes",
    HOURS = "hours"
}

export enum VALID_RANGE_TYPE {
    ALWAYS = "always",
    BETWEEN = "between",
    FROM = "from",
    UNTIL = "until",
    FOR = "for"
}

export enum DB_PERMISSION {
    SELECT = "SELECT",
    INSERT = "INSERT",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    TRUNCATE = "TRUNCATE",
    CREATE_TABLE = "CREATE TABLE",
    DROP_TABLE = "DROP TABLE",
    ALTER_TABLE = "ALTER TABLE",
    CREATE_VIEW = "CREATE VIEW",
    DROP_VIEW = "DROP VIEW",
    CREATE_SCHEMA = "CREATE SCHEMA",
    DROP_SCHEMA = "DROP SCHEMA",
    PASSTHROUGH = "PASSTHROUGH",
    MASKED = "MASKED PASSTHROUGH",
    PROTECTED = "PROTECTED PASSTHROUGH",
    CALL = "CALL",
    EXECUTE_SQL_BLOCK = "EXECUTE SQL BLOCK"
}

/*

*/
export enum MAMORI_PERMISSION {
    ALERT = "ALERT",
    ALL_PRIVILEGES = "ALL PRIVILEGES",
    ALTER_DRIVER = "ALTER DRIVER",
    ALTER_POLICY = "ALTER POLICY",
    ALTER_USER = "ALTER USER",
    CANCEL_SESSION = "CANCEL SESSION",
    CHECK_PERMISSION = "CHECK PERMISSION",
    CLEAR_CACHE = "CLEAR CACHE",
    CONNECT = "CONNECT",
    COPY_USER = "COPY USER",
    CREATE_BACKUP = "CREATE BACKUP",
    CREATE_DRIVER = "CREATE DRIVER",
    CREATE_IP_RESOURCE = "CREATE IP RESOURCE",
    CREATE_JOB_OWNER = "CREATE JOB OWNER",
    CREATE_ROLE = "CREATE ROLE",
    CREATE_SYSTEM = "CREATE SYSTEM",
    CREATE_USER = "CREATE USER",
    DISABLE_USER = "DISABLE USER",
    DROP_DRIVER = "DROP DRIVER",
    DROP_JOB = "DROP JOB",
    DROP_ROLE = "DROP ROLE",
    DROP_USER = "DROP USER",
    EXECUTE_JOB = "EXECUTE JOB",
    GRANT_ROLE = "GRANT ROLE",
    IP_SCAN = "IP SCAN",
    JMX_ACCESS = "JMX ACCESS",
    LOG_ACCESS = "LOG ACCESS",
    LOG_SESSION = "LOG_SESSION",
    MASKING_RULE_ADMIN = "MASKING RULE ADMIN",
    QUERY_CONSOLE_ACCESS = "QUERY CONSOLE ACCESS",
    REQUEST = "REQUEST",
    RESTART_SERVER = "RESTART SERVER",
    RESTRICT_USER = "RESTRICT USER",
    REVOKE_ROLE = "REVOKE ROLE",
    RULE = "RULE",
    SET_DEFAULT_AUTHENTICATION_PROVIDER = "SET DEFAULT AUTHENTICATION PROVIDER",
    SET_DESCRIBE = "SET DESCRIBE",
    SET_LOGGING_LEVEL = "SET LOGGING_LEVEL",
    SET_PAUSECLEANUP = "SET PAUSECLEANUP",
    SET_SERVER_NAME = "SET SERVER_NAME",
    SET_SYSTEM_PROPERTY = "SET SYSTEM PROPERTY",
    SYSTEM_MONITOR = "SYSTEM MONITOR",
    VIEW_ALL_USER_LOGS = "VIEW ALL USER LOGS",
    VIEW_CLEAR_SQL_LOG = "VIEW CLEAR SQL LOG",
    WEB_EXPORT_DATA = "WEB EXPORT DATA",
    WEB_SQL_EDITOR = "WEB SQL EDITOR",
    ALTER_ENCRYPTION_KEY = "ALTER ENCRYPTION KEY",
    CREATE_ENCRYPTION_KEY = "CREATE ENCRYPTION KEY",
    DROP_ENCRYPTION_KEY = "DROP ENCRYPTION KEY"
}

export class Permissions {
    public static list(api: MamoriService, filter?: any): Promise<any> {

        let filters = filter;
        if (filter && Array.isArray(filter)) {
            let ndx = 0;
            filters = {};
            filter.forEach((element: any) => {
                filters[ndx.toString()] = element;
                ndx++
            });
        }

        let path = "/v1/search/grantee_permissions";
        let payload = filter ? { filter: filters } : {};
        return api.callAPI("PUT", path, payload);
    }

    public static factory(rec: any): PermissionBase {
        if (rec.permissiontype == 'SSH') {
            return new SSHLoginPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'IP USAGE') {
            return new IPResourcePermission().fromJSON(rec);
        } else if (rec.permissiontype == 'RDP') {
            return new RemoteDesktopLoginPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'KEY USAGE') {
            return new KeyPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'REVEAL SECRET') {
            return new SecretPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'HTTP ACCESS') {
            return new HTTPResourcePermission().fromJSON(rec);
        } else if (Object.values(DB_PERMISSION).includes(rec.permissiontype)) {
            return new DatasourcePermission().permission(rec.permissiontype).fromJSON(rec);
        } else if (Object.values(MAMORI_PERMISSION).includes(rec.permissiontype)) {
            return new MamoriPermission([rec.permissiontype]).fromJSON(rec);
        } else {
            console.log("**** Permission.factory MISSING TYPE : %s", rec.permissiontype)
            return new PermissionBase();
        }
        //
        //"UNAUTHENTICATED IP USAGE"
        //
        //""
        //POLICY
        //
    }

    public static make(type: PERMISSION_TYPE): PermissionBase {
        switch (type) {
            case PERMISSION_TYPE.DATASOURCE:
                return new DatasourcePermission();
            case PERMISSION_TYPE.IP_RESOURCE:
                return new IPResourcePermission();
            case PERMISSION_TYPE.KEY:
                return new KeyPermission();
            case PERMISSION_TYPE.MAMORI:
                return new MamoriPermission();
            case PERMISSION_TYPE.POLICY:
                return new PolicyPermission();
            case PERMISSION_TYPE.REMOTE_DESKTOP:
                return new RemoteDesktopLoginPermission();
            case PERMISSION_TYPE.ROLE:
                return new RolePermission();
            case PERMISSION_TYPE.SSH:
                return new SSHLoginPermission();
            case PERMISSION_TYPE.HTTP_RESOURCE:
                return new HTTPResourcePermission();
            case PERMISSION_TYPE.SECRET:
                return new SecretPermission();
        }
    }
}

export class PermissionBase implements ISerializable {

    private recipient?: string;
    private validType?: VALID_RANGE_TYPE;
    private validFrom?: string;
    private validUntil?: string;
    private validForDuration?: Number;
    private validForUnit?: TIME_UNIT;
    private grantable?: boolean;
    private revokeAll?: Number;
    options?: any;

    public static DATETIME_FORMAT(): string {
        return "YYYY-MM-DD HH:mm";
    }
    public static DATET_FORMAT(): string {
        return "YYYY-MM-DD";
    }

    public constructor() {
        this.recipient = "";

        this.validType = VALID_RANGE_TYPE.ALWAYS;
        this.validFrom = PermissionBase.DATETIME_FORMAT();
        this.validUntil = PermissionBase.DATETIME_FORMAT();
        this.validForDuration = 0;
        this.validForUnit = TIME_UNIT.SECONDS;

        this.grantable = false;
        this.revokeAll = -1;

        this.options = {};

    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        if (record.grantee) {
            this.grantee(record.grantee);
        }

        for (let prop in this) {
            if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }

    /**
     * Serialize the object to JSON
     * @param
     * @returns JSON 
     */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                res[prop] = this[prop];
            }
        }
        return res;
    }

    /**
     * @param grantee  The recipient of the permission 
     * @returns 
     */
    public grantee(name: string): PermissionBase {
        this.recipient = name;
        return this;
    }

    /**
     * For revokes.  Will remove all permissions of the same type and object 
     * @param value  True or False
     * @returns 
    */
    public all(value: boolean): PermissionBase {
        this.revokeAll = value ? 1 : 0;
        return this;
    }

    /**
     * Allow user to grant this permission 
     * @param value  True or False
     * @returns 
    */
    public withGrantOption(value: boolean): PermissionBase {
        this.grantable = value;
        return this;
    }

    /**
     * Grant permission for a set amount of time
     * @param duration The amount
     * @param unit  The time unit (seconds, minutes, hours)
     * @returns 
    */
    public withValidFor(duration: Number, unit: TIME_UNIT): PermissionBase {
        this.validType = VALID_RANGE_TYPE.FOR;
        this.validForDuration = duration;
        this.validForUnit = unit;
        return this;
    }

    /**
     * Grant a permission that is valid from a datetime
     * @param from The from date & time (YYYY-MM-DD HH:MM)
     * @returns 
    */
    public withValidFrom(from: string): PermissionBase {
        this.validType = VALID_RANGE_TYPE.FROM;
        this.validFrom = from;
        return this;
    }

    /**
     * Grant a permission that is valid until a datetime
     * @param until A date & time (YYYY-MM-DD HH:MM)
     * @returns 
    */
    public withValidUntil(until: string): PermissionBase {
        this.validType = VALID_RANGE_TYPE.UNTIL;
        this.validUntil = until;
        return this;
    }

    /**
     * Grant a permission that is valid for a datetime range
     * @param from A date & time (YYYY-MM-DD HH:MM)  
     * @param until A date & time (YYYY-MM-DD HH:MM)
     * @returns 
    */
    public withValidBetween(from: string, until: string): PermissionBase {
        this.validType = VALID_RANGE_TYPE.BETWEEN;
        this.validFrom = from;
        this.validUntil = until;
        return this;
    }

    /**
     * Prepares and validates the payload
     * @param 
     * @returns 
    */
    public prepare(): any {
        this.options = {};
        if (this.validType == VALID_RANGE_TYPE.BETWEEN) {
            this.options.valid_from = this.validFrom;
            this.options.valid_until = this.validUntil;
        } else if (this.validType == VALID_RANGE_TYPE.FROM) {
            this.options.valid_from = this.validFrom;
        } else if (this.validType == VALID_RANGE_TYPE.UNTIL) {
            this.options.valid_until = this.validUntil;
        } else if (this.validType == VALID_RANGE_TYPE.FOR) {
            this.options.valid_duration = this.validForDuration;
            this.options.valid_unit = this.validForUnit;
        }

        if (this.grantable) {
            this.options.with_grant_option = "true";
        }

        if (this.revokeAll == 1) {
            this.options.cascade = "true";
        } else if (this.revokeAll == 0) {
            this.options.cascade = "false";
        }

        return { grantee: this.recipient, options: this.options };
    }


    private handleResult(result: any) {
        let errors = result.filter((value: any) => value.toLowerCase().includes("error"));
        if (errors.length > 0) {
            throw new Error(result);
        }
        return { errors: false, result };
    }
    /**
     * Executes the grant
     * @param api 
     * @returns 
    */
    public grant(api: MamoriService): Promise<any> {
        this.prepare();
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent(this.recipient!.toLowerCase()), this.options).then(result => {
            return this.handleResult(result);
        });
    }

    /**
     * Executes the revoke
     * @param api 
     * @returns 
    */
    public revoke(api: MamoriService): Promise<any> {
        this.prepare();
        return api.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(this.recipient!.toLowerCase()), this.options).then(result => {
            return this.handleResult(result);
        });
    }

    /**
     * Executes the revoke
     * @param api 
     * @returns 
    */
    public revokeByID(api: MamoriService, id: Number): Promise<any> {
        return api.callAPI("DELETE", "/v1/permissions/granted/" + id);
    }

    /**
     * Searches the permissions
     * NOTE: Non-admins will only be able to see their permissions
     * @param api 
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns 
    */
    public list(api: MamoriService, filter?: any): Promise<any> {

        let filters = filter;
        if (filter && Array.isArray(filter)) {
            let ndx = 0;
            filters = {};
            filter.forEach((element: any) => {
                filters[ndx.toString()] = element;
                ndx++
            });
        }

        this.prepare();
        let path = "/v1/search/grantee_permissions?grantee=" + encodeURIComponent(this.recipient!.toLowerCase());
        let payload = filter ? { filter: filters } : {};
        return api.callAPI("PUT", path, payload);
    }
}

export class DatasourcePermission extends PermissionBase {
    private items?: DB_PERMISSION[];
    private datasource?: string;
    private database?: string;
    private schema?: string;
    private object?: string;
    private where?: string;
    private rowLimit?: string;

    public constructor() {
        super();
        this.rowLimit = "";
        this.items = [];
    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        for (let prop in this) {
            if (record.hasOwnProperty(prop)) {
                if (prop === "permissions") {
                    this["items"] = record[prop].split(",");
                } else {
                    this[prop] = record[prop];
                }
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop === "items") {
                    res["permissions"] = (this[prop] as any).join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }

    /**
    *  The database object path
    * @param datasource Mamori datasource name  ( enter * for all)
    * @param database name  ( enter * for all)
    * @param schema Name  ( enter * for all)
    * @param object Name  ( enter * for all)
    * @returns  
    */
    public on(datasource: string, database: string, schema: string, object: string): DatasourcePermission {
        this.datasource = datasource;
        this.database = database;
        this.schema = schema;
        this.object = object;
        return this;
    }

    /**
    * Add option to see all rows.
    * @param limit the number of rows
    * @returns  
    */
    public withUnlimitedRows(): DatasourcePermission {
        this.rowLimit = "none";
        return this;
    }

    /**
    * Add option limit on the number of rows returned
    * @param limit the number of rows
    * @returns  
    */
    public withRowLimit(limit: Number): DatasourcePermission {
        this.rowLimit = limit.toString();
        return this;
    }

    /**
    * Set a where condition
    * @param clause a clause (do not include WHERE)
    * @returns  
    */
    public withClause(clause: string): DatasourcePermission {
        this.where = clause;
        return this;
    }

    private quoteNameValue(val: string): string {
        if (val == "*") {
            return "*";
        } else if (val && val != "") {
            return "\"" + val + "\""
        }
        return "";
    }

    /**
    * Set the permission to grant
    * @param name The name of the SSH Login
    * @returns  
    */
    public permission(name: DB_PERMISSION): DatasourcePermission {
        this.items = [name];
        return this;
    }

    /**
    * Set list of permissions to grant
    * @param names an array of permission names
    * @returns  
    */
    public permissions(names: DB_PERMISSION[]): DatasourcePermission {
        this.items = names;
        return this;
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        //
        if (this.where && this.where != "") {
            this.options.where_clause = this.where;
        }
        if (this.rowLimit && this.rowLimit != "") {
            this.options.limit = this.rowLimit;
        }
        let obj: string[] = [];

        let ds = this.quoteNameValue(this.datasource!);
        if (ds) {
            obj.push(ds)
        }

        let db = this.quoteNameValue(this.database!);
        if (db) {
            obj.push(db)
        }

        let sc = this.quoteNameValue(this.schema!);
        if (sc) {
            obj.push(sc)
        }

        let ob = this.quoteNameValue(this.object!);
        if (ob) {
            obj.push(ob)
        }
        this.options.object_name = obj.join(".");
        return res;
    }
}

export class PolicyPermission extends PermissionBase {
    private items?: string[];

    public constructor() {
        super();
        this.items = [];
    }
    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        for (let prop in this) {
            if (prop == "policies") {
                this.items = record["policies"].split(",");
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop === "items") {
                    res["policies"] = (this[prop] as any).join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }

    /**
    * Set the policy name to grant
    * @param name The name of the policy
    * @returns  
    */
    public policy(name: string): PolicyPermission {
        this.items = [" POLICY \"" + name + "\""];
        return this;
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        return res;
    }
}

export class KeyPermission extends PermissionBase {
    private items?: string[];
    private keyName?: string;

    public constructor() {
        super();
        this.keyName = "";
        this.items = [];
    }

    /**
    * Set the key name to grant
    * @param name The name of the encryption key
    * @returns  
    */
    public key(name: string): KeyPermission {
        this.items = ["KEY USAGE"];
        this.keyName = name;
        return this;
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        this.options.object_name = this.keyName;
        return res;
    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        for (let prop in this) {
            if (prop == "items" && record.hasOwnProperty("permissions")) {
                this.items = record["permissions"].split(",");
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop == "items") {
                    res["permissions"] = this.items?.join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }
}

export class RolePermission extends PermissionBase {
    private items?: string[];

    public constructor() {
        super();
        this.items = [];
    }
    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        for (let prop in this) {
            if (prop == "role") {
                this.role(record[prop].split(",")[0]);
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop === "items") {
                    res["role"] = (this[prop] as any).join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }

    /**
    * Set the role name to grant
    * @param name The name of the role
    * @returns  
    */
    public role(name: string): RolePermission {
        this.items = [name];
        return this;
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        return res;
    }
}

export class SSHLoginPermission extends PermissionBase {
    private items?: string[];
    private sshLoginName?: string;
    public constructor() {
        super();
        this.sshLoginName = "";
        this.items = ["SSH"];
    }

    /**
     * Set the SSH login to grant
     * @param name The name of the SSH Login
     * @returns  
     */
    public sshLogin(name: string): SSHLoginPermission {
        this.sshLoginName = name;
        return this;
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        this.options.object_name = this.sshLoginName;
        return res;
    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        if (record.key_name && record.key_name != '') {
            this.sshLogin(record.key_name);
        }

        for (let prop in this) {
            if (prop == "items" && record.hasOwnProperty("permissions")) {
                this.items = record["permissions"].split(",");
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop == "items") {
                    res["permissions"] = this.items?.join(",");
                } else {
                    res[prop] = this[prop];
                }

            }
        }
        return res;
    }
}

//GRANT IP USAGE ON {resource} TO {grantee}
//GRANT UNAUTHENTICATED IP USAGE ON {resource} TO {grantee}
export class IPResourcePermission extends PermissionBase {
    private items?: string[];
    private resourceName?: string;

    public constructor() {
        super();
        this.resourceName = "";
        this.items = ["IP USAGE"];
    }

    /**
    * Set the name to grant
    * @param name The name of the resource
    * @returns  
    */
    public resource(name: string): IPResourcePermission {
        this.resourceName = name;
        return this;
    }

    public always2FA(value: boolean) {
        if (value) {
            this.items = ["IP USAGE"];
        } else {
            this.items = ["UNAUTHENTICATED IP USAGE"];
        }
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        this.options.object_name = '"' + this.resourceName + '"';
        return res;
    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        if (record.key_name && record.key_name != '') {
            this.resourceName = record.key_name;
        }
        for (let prop in this) {
            if (prop == "items" && record.hasOwnProperty("permissions")) {
                this.items = record["permissions"].split(",");
            } else if (prop === "always2fa") {
                this.always2FA(record[prop] === "true");
            }
            else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop == "items") {
                    res["permissions"] = this.items?.join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }
}

/**
     * Class to grant mamori server permissions
     * GRANT {permission} TO {grantee}
*/
export class MamoriPermission extends PermissionBase {
    private items?: MAMORI_PERMISSION[]

    public constructor(permissions?: MAMORI_PERMISSION[]) {
        super();
        this.items = permissions ? permissions : [];
    }
    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        for (let prop in this) {
            if (prop == "permission") {
                this.permission(record[prop].split(",")[0]);
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop === "items") {
                    res["permission"] = (this[prop] as any).join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }

    /**
    * Set the permission to grant
    * @param name The name of the permission
    * @returns  
    */
    public permission(name: MAMORI_PERMISSION): MamoriPermission {
        this.items = [name];
        return this;
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        return res;
    }
}


export class RemoteDesktopLoginPermission extends PermissionBase {
    private items?: string[];
    private RDLoginName?: string;
    public constructor() {
        super();
        this.RDLoginName = "";
        this.items = ["RDP"];
    }

    /**
     * Set the RDP login to grant
     * @param name The name of the RDP Login
     * @returns  
     */
    public name(name: string): RemoteDesktopLoginPermission {
        this.RDLoginName = name;
        return this;
    }

    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        this.options.object_name = this.RDLoginName;
        return res;
    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        if (record.key_name && record.key_name != '') {
            this.name(record.key_name);
        }

        for (let prop in this) {
            if (prop == "items" && record.hasOwnProperty("permissions")) {
                this.items = record["permissions"].split(",");
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop == "items") {
                    res["permissions"] = this.items?.join(",");
                } else {
                    res[prop] = this[prop];
                }

            }
        }
        return res;
    }
}

export class SecretPermission extends PermissionBase {
    private items?: string[];
    private secretName?: string;

    public constructor() {
        super();
        this.secretName = "";
        this.items = ["REVEAL SECRET"];
    }

    /**
    * Set the name to grant
    * @param name The name of the resource
    * @returns  
    */
    public name(name: string): SecretPermission {
        this.secretName = name;
        return this;
    }


    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        this.options.object_name = '"' + this.secretName + '"';
        return res;
    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        if (record.key_name && record.key_name != '') {
            this.secretName = record.key_name;
        }
        for (let prop in this) {
            if (prop == "items" && record.hasOwnProperty("permissions")) {
                this.items = record["permissions"].split(",");
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop == "items") {
                    res["permissions"] = this.items?.join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }
}

export class HTTPResourcePermission extends PermissionBase {
    private items?: string[];
    private itemName?: string;

    public constructor() {
        super();
        this.itemName = "";
        this.items = ["HTTP ACCESS"];
    }

    /**
    * Set the name to grant
    * @param name The name of the resource
    * @returns  
    */
    public name(name: string): HTTPResourcePermission {
        this.itemName = name;
        return this;
    }


    public prepare(): any {
        let res = super.prepare();
        this.options.grantables = this.items;
        this.options.object_name = '"' + this.itemName + '"';
        return res;
    }

    /**
     * Initialize the object from JSON.
     * Call toJSON to see the expected record.
     * @param record JSON record
     * @returns
     */
    fromJSON(record: any) {
        super.fromJSON(record);
        if (record.key_name && record.key_name != '') {
            this.itemName = record.key_name;
        }
        for (let prop in this) {
            if (prop == "items" && record.hasOwnProperty("permissions")) {
                this.items = record["permissions"].split(",");
            } else if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }
    /**
    * Serialize the object to JSON
    * @param
    * @returns JSON 
    */
    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            if (prop != "options") {
                if (prop == "items") {
                    res["permissions"] = this.items?.join(",");
                } else {
                    res[prop] = this[prop];
                }
            }
        }
        return res;
    }
}











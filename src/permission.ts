/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */

import { stringify } from 'querystring';
import { runInThisContext } from 'vm';
import { MamoriService, LoginResponse } from './api';
import { ISerializable } from "./i-serializable";


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

export enum DB_PERMISSIONS {
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
    PROTECTED = "PROTECTED PASSTHROUGH"
}


class PermissionBase implements ISerializable {

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
            console.log("GRANT Errors results %o", result);
            return { errors: true, result };
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
        if (filter && filter.length > 1) {
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
    private items?: DB_PERMISSIONS[];
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
    public permission(name: DB_PERMISSIONS): DatasourcePermission {
        this.items = [name];
        return this;
    }

    /**
    * Set list of permissions to grant
    * @param names an array of permission names
    * @returns  
    */
    public permissions(names: DB_PERMISSIONS[]): DatasourcePermission {
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
        for (let prop in this) {
            if (prop == "items") {
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
        this.items = [];
    }

    /**
     * Set the SSH login to grant
     * @param name The name of the SSH Login
     * @returns  
     */
    public sshLogin(name: string): SSHLoginPermission {
        this.items = ["SSH"];
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
        for (let prop in this) {
            if (prop == "items") {
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








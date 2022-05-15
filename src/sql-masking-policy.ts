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
import { PolicyPermission } from './permission';
import { FILTER_OPERATION, prepareFilter, addFilterToDxGridOptions } from './utils';


export enum TABLE_TYPE {
    TABLE = "table",
    RESULTSET = "resultset"
}

export class SQLMaskingPolicy implements ISerializable {

    /**
     * Searches on demand policies
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns users
    */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.db_masking_policies(payload);
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns A SQL Making Policy
     */
    public static get(api: MamoriService, name: string): Promise<any> {
        return api.read_db_policy(name).then(r => {
            if (r.length > 0) {
                let x: any = r[0];
                let p = new SQLMaskingPolicy(x.name).fromJSON(x);
                //Get the masking policies
                return p;
            }
            return null;
        });
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

            res[prop] = this[prop];
        }
        return res;
    }

    id: Number | null;
    name: string;
    priority: number | null;
    rules: any[];

    public constructor(name: string) {
        this.id = null;
        this.name = name;
        this.priority = null;
        this.rules = [];
    }

    public listColumnRules(api: MamoriService): Promise<any> {
        let payload = {};
        addFilterToDxGridOptions(payload, "name", FILTER_OPERATION.EQUALS_STRING, this.name);
        return api.policies_get_policy_column_rules(payload).then((data) => {
            return data;
        });
    }

    public addColumnRule(api: MamoriService, table_name: string, column_name: string, expression: string, table_type?: TABLE_TYPE | null): Promise<any> {
        return api.policies_set_policy_projection(table_name, column_name, expression, this.name, table_type).then(r => {
            if (r && r.length > 0) {
                return { errors: false, response: r[0] };
            }
        });
    }

    public deleteColumnRule(api: MamoriService, table_name: string, column_name: string, table_type?: TABLE_TYPE | null): Promise<any> {
        return api.policies_set_policy_projection(table_name, column_name, "REVEAL", this.name, table_type);
    }

    public create(api: MamoriService): Promise<any> {
        return api.create_db_policy(this.name, this.priority, "");
    }

    public update(api: MamoriService): Promise<any> {
        let data: any = { id: this.id, name: this.name };
        if (this.priority && !isNaN(Number(this.priority))) {
            data.priority = this.priority;
        }
        console.log("**** %o", data);
        return api.update_db_policy(this.id, data);
    }


    public delete(api: MamoriService) {
        return api.delete_db_policy(this.name);
    }

    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return new PolicyPermission().policy(this.name).grantee(grantee).grant(api);
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return new PolicyPermission().policy(this.name).grantee(grantee).revoke(api);
    }
}
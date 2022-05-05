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
import { prepareFilter } from './utils';


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

        return api.select(
            "select * from SYS.DATA_POLICIES ",
            payload
        )
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

    public create(api: MamoriService): Promise<any> {
        return api.create_db_policy(this.name, this.priority, "");
    }

    public update(api: MamoriService): Promise<any> {
        let data: any = { id: this.id, name: this.name };
        if (this.priority) {
            data.priority = this.priority;
        }
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
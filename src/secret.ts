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
import { sqlEscape, prepareFilter } from './utils';
import { SecretPermission } from './permission';

export enum SECRET_TYPE {
    AES = "AES",
    RSA = "RSA",
    SSH = "SSH"
}

export class Secret implements ISerializable {

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): Secret {
        let result = new Secret(ds.type, ds.name);
        result.fromJSON(ds);
        return result;
    }

    public static revealWithID(api: MamoriService, id: string): Promise<any> {
        let query = "call REVEAL_SECRET(" + id + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    /**
     * Searches secrets
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns users
    */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.callAPI("PUT", "/v1/search/secrets", payload);
    }


    id?: number;
    type?: SECRET_TYPE;
    secret?: string;
    name: string;
    username?: string;
    host?: string;
    description?: string;
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


    /**
     * @param name  Unique Key name
     */
    public constructor(type: SECRET_TYPE, name: string) {
        this.type = type;
        this.name = name;

    }

    /**
     * @param api 
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        let query = "call CREATE_SECRET(" + this.toQueryParams() + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    public delete(api: MamoriService): Promise<any> {
        let query = "call DELETE_SECRET(" + this.id + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    public update(api: MamoriService): Promise<any> {
        let query = "call UPDATE_SECRET(" + this.id + ", " + this.toQueryParams() + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    public reveal(api: MamoriService): Promise<any> {
        let query = "call REVEAL_SECRET(" + this.id + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    private toQueryParams() {
        return (
            "'" +
            sqlEscape(this.name) +
            "', '" +
            sqlEscape(this.secret || "") +
            "', '" +
            sqlEscape(this.description || "") +
            "', '" +
            sqlEscape(this.username || "") +
            "', '" +
            sqlEscape(this.host || "") +
            "', '" +
            sqlEscape(this.type || "") +
            "'"
        );
    }


    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return new SecretPermission().name(this.name).grantee(grantee).grant(api);
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return new SecretPermission().name(this.name).grantee(grantee).revoke(api);
    }

    /**
     * @param secret  The secret text
     * @returns 
     */
    public withSecret(secret: string): Secret {
        this.secret = secret;
        return this;
    }

    /**
     * @param username  The username
     * @returns 
     */
    public withUsername(username: string): Secret {
        this.username = username;
        return this;
    }

    /**
     * @param host  The host
     * @returns 
     */
    public withHost(host: string): Secret {
        this.host = host;
        return this;
    }

    /**
     * @param Description  The host
     * @returns 
     */
    public withDescription(desc: string): Secret {
        this.description = desc;
        return this;
    }


}

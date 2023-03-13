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
import { HTTPResourcePermission } from './permission';


export class HTTPResource implements ISerializable {

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): HTTPResource {
        let result = new HTTPResource(ds.name);
        result.fromJSON(ds);
        return result;
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
        return api.callAPI("PUT", "/v1/search/web_resources", payload);
    }

    public static getByName(api: MamoriService, name: string): Promise<any> {
        let filters = [["name", "=", name]];
        return HTTPResource.list(api, 0, 5, filters).then(data => {
            if (data.data.length > 0) {
                let s = HTTPResource.build(data.data[0]);
                return s;
            }
            return null;
        });
    }


    id?: string;
    name: string;
    url?: string;
    host?: string;
    port?: any;
    description?: string;
    updated_at?: string;
    created_at?: string;
    active_access?: string;
    request_via?: any;
    exclude_from_pac?: any;

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
    public constructor(name: string) {
        this.name = name;
        this.url = '';
        this.host = '';
        this.port = '';
        this.description = '';
        this.id = '';
        this.updated_at = '';
        this.created_at = '';
        this.active_access = '';
        this.exclude_from_pac = '';
        this.request_via = null;
        this.exclude_from_pac = false;
    }

    public withName(name: string): HTTPResource {
        this.name = name;
        return this;
    }

    public withURL(value: string): HTTPResource {
        this.url = value;
        let m = (value || "").match(/(https?):\/\/([^:\/]+):?([0-9]*).*/);
        if (m) {
            let protocol = m[1];
            this.host = m[2];
            this.port = Number(m[3] || (protocol == "http" ? 80 : 443));
        }
        return this;
    }

    public withDescription(desc: string): HTTPResource {
        this.description = desc;
        return this;
    }

    public withExcludeFromPAC(value: boolean): HTTPResource {
        this.exclude_from_pac = value;
        return this;
    }

    /**
     * @param api 
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        let query = "call add_http_resource(" + this.toQueryParams() + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    public delete(api: MamoriService): Promise<any> {
        let query = "call delete_http_resource('" + sqlEscape(this.name) + "')";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    public update(api: MamoriService): Promise<any> {
        let query = "call update_http_resource(" + this.id + ", " + this.toQueryParams() + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }



    private portNumber(v: any) {
        if (v === "*") {
            return 0;
        }
        return v;
    }

    private toQueryParams() {
        return (
            "'" +
            sqlEscape(this.name) +
            "', '" +
            sqlEscape(this.host!) +
            "', " +
            this.portNumber(this.port) +
            ", '" +
            sqlEscape(this.url || "") +
            "', '" +
            sqlEscape(this.description || "") +
            "', " +
            (this.exclude_from_pac ? "true" : "false")
        );
    }


    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return new HTTPResourcePermission().name(this.name).grantee(grantee).grant(api);
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return new HTTPResourcePermission().name(this.name).grantee(grantee).revoke(api);
    }

}

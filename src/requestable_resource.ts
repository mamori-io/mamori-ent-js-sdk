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
import { prepareFilter, addFilterToDxGridOptions } from './utils';


export enum REQUEST_RESOURCE_TYPE {
    DATASOURCE = "DATASOURCE",
    HTTP_RESOURCE = "HTTP RESOURCE",
    REMOTE_DESKTOP = "REMOTE DESKTOP",
    SECRET = "SECRET",
    IP_RESOURCE = "IP RESOURCE",
    SSH_LOGIN = "SSH LOGIN",
    ENCRYPTION_KEY = "ENCRYPTION KEY",
    RESOURCE_GROUP = "RESOURCE GROUP"
}

export class RequestableResource implements ISerializable {

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): RequestableResource {
        let result = new RequestableResource(ds.type);
        result.fromJSON(ds);
        return result;
    }

    public static revealWithID(api: MamoriService, id: string): Promise<any> {
        let query = "call REVEAL_SECRET(" + id + ")";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.callAPI("GET", "/v1/requestable_resources", payload);
    }

    public static listFor(api: MamoriService, from: number, to: number, type: any, grantee: any, resource: any, policy: any): Promise<any> {
        let options = { skip: from, take: to };

        if (type) {
            addFilterToDxGridOptions(
                options,
                "resource_type",
                "equals",
                type
            );
        }

        if (grantee) {
            addFilterToDxGridOptions(
                options,
                "grantee",
                "equals",
                grantee
            );
        }

        if (resource) {
            addFilterToDxGridOptions(
                options,
                "resource_name",
                "equals",
                resource
            );
        }

        if (policy) {
            addFilterToDxGridOptions(
                options,
                "policy_name",
                "equals",
                policy
            );
        }

        return api.callAPI("GET", "/v1/requestable_resources", options);
    }


    public static getByName(api: MamoriService, type: any, grantee: any, resource: any, policy: any): Promise<any> {
        return RequestableResource.listFor(api, 0, 5, type, grantee, resource, policy).then(data => {
            if (data.data.length > 0) {
                let s = RequestableResource.build(data.data[0]);
                return s;
            }
            return null;
        });
    }

    public static deleteByName(api: MamoriService, type: any, grantee: any, resource: any, policy: any): Promise<any> {
        return new Promise((resolve, reject) => {
            RequestableResource.getByName(api, type, grantee, resource, policy).then(res => {
                if (res) {
                    (res as RequestableResource).delete(api).then(r => {
                        resolve({ error: false, item: res });
                    });
                } else {
                    resolve({ error: false, item: null, message: "resource not found" });
                }
            }).catch(e => {
                reject({ error: true, exception: e });
            })
        });
    }

    get struc(): any {
        return { id: "", resource_type: "", resource_login: "", resource_name: "", grantee: "", privileges: "", policy_name: "", description: "" };
    }


    id?: string;
    resource_type: REQUEST_RESOURCE_TYPE;
    resource_login: string;
    resource_name: string;
    grantee: string;
    privileges: string;
    policy_name: string;
    description: string;

    fromJSON(record: any) {
        for (let prop in this) {
            if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }

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
    public constructor(type: REQUEST_RESOURCE_TYPE) {
        this.id = "";
        this.resource_type = type;
        this.resource_login = "";
        this.resource_name = "";
        this.grantee = "";
        this.privileges = "";
        this.policy_name = "";
        this.description = "";
    }

    public withResource(resource: string): RequestableResource {
        this.resource_name = resource;
        return this;
    }

    public withLogin(value: string): RequestableResource {
        this.resource_login = value;
        return this;
    }

    public withGrantee(value: string): RequestableResource {
        this.grantee = value;
        return this;
    }

    public withPrivileges(value: string): RequestableResource {
        this.privileges = value;
        return this;
    }

    public withPolicy(value: string): RequestableResource {
        this.policy_name = value;
        return this;
    }

    public withDescription(value: string): RequestableResource {
        this.description = value;
        return this;
    }

    public getDefaultPrivileges(type: REQUEST_RESOURCE_TYPE): any {
        switch (type) {
            case REQUEST_RESOURCE_TYPE.DATASOURCE:
                return "CREDENTIAL USAGE";
                break;
            case REQUEST_RESOURCE_TYPE.HTTP_RESOURCE:
                return "HTTP ACCESS";
                break;
            case REQUEST_RESOURCE_TYPE.REMOTE_DESKTOP:
                return "RDP";
                break;
            case REQUEST_RESOURCE_TYPE.SECRET:
                return "REVEAL SECRET";
                break;
            case REQUEST_RESOURCE_TYPE.IP_RESOURCE:
                return "IP USAGE";
                break;
            case REQUEST_RESOURCE_TYPE.SSH_LOGIN:
                return "SSH,SFTP";
                break;
            case REQUEST_RESOURCE_TYPE.ENCRYPTION_KEY:
                return "KEY USAGE";
                break;
            case REQUEST_RESOURCE_TYPE.RESOURCE_GROUP:
                return "";
                break;
            default:
                return "";
            // code block
        }
    }


    public payload(): any {
        return {
            resource_type: this.resource_type,
            resource_login: this.resource_login,
            resource_name: this.resource_name,
            grantee: this.grantee,
            privileges: this.privileges,
            policy_name: this.policy_name,
            description: this.description
        }
    }

    /**
     * @param api 
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        if (this.privileges == '') {
            this.privileges = this.getDefaultPrivileges(this.resource_type);
        }
        return api.callAPI("POST", "/v1/requestable_resources", this.payload());
    }

    public delete(api: MamoriService): Promise<any> {
        return api.callAPI("DELETE", "/v1/requestable_resources/" + this.id);
    }

    public update(api: MamoriService): Promise<any> {
        return api.callAPI("PUT", "/v1/requestable_resources" + "/" + this.id, this.payload());
    }


}

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

export enum SECRET_PROTOCOL {
    GENERIC = "",
    RDP = "rdp",
    SSH = "ssh",
    DB = "db"
}

export enum SECRET_TYPE {
    SECRET = "SECRET",
    MULTI_SECRET = "MULTI-SECRET"
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

    /**
     * Searches secrets
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns users
    */
    public static getByName(api: MamoriService, name: string): Promise<any> {
        let filters = prepareFilter([["name", "=", name]]);
        let payload = { skip: 0, take: 100, filter: filters };
        return api.callAPI("PUT", "/v1/search/secrets", payload).then(data => {
            if (data.data.length > 0) {
                let s = Secret.build(data.data[0]);
                if (s.type == SECRET_TYPE.MULTI_SECRET) {
                    return s.getMultiSecretParts(api).then((parts: any) => {
                        s.secret = parts;
                        return s;
                    });
                }
                return s;
            }
            return null;
        });
    }

    public static exportByName(api: MamoriService, name: string, keyName: string): Promise<any> {
        let filters = prepareFilter([["name", "=", name]]);
        let payload = { skip: 0, take: 100, filter: filters };
        return api.callAPI("PUT", "/v1/search/secrets", payload).then(data => {
            if (data.data.length > 0) {
                let s = Secret.build(data.data[0]);
                return s.exportSecretWithKey(api, keyName).then((parts: any) => {
                    s.secret = parts;
                    return s;
                });
            }
            return null;
        });
    }

    public static deleteByName(api: MamoriService, name: string): Promise<any> {
        return new Promise((resolve, reject) => {
            Secret.getByName(api, name).then(res => {
                if (res) {
                    (res as Secret).delete(api).then(r => {
                        resolve({ error: false, item: res });
                    });
                } else {
                    resolve({ error: false, item: null, message: "secret not found" });
                }
            }).catch(e => {
                reject({ error: true, exception: e });
            })
        });
    }


    id?: string;
    type?: SECRET_TYPE;
    protocol?: SECRET_PROTOCOL;
    secret?: any;
    name: string;
    username?: string;
    hostname?: string;
    description?: string;
    updated_at?: string;
    created_at?: string;
    active_access?: string;
    encoding?: string;
    expires_at?: Date;
    alert_at?: Date;
    expiry_alert?: string;

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
    public constructor(protocol: SECRET_PROTOCOL, name: string) {
        this.protocol = protocol;
        this.type = SECRET_TYPE.SECRET;
        this.name = name;
        this.hostname = '';
        this.username = '';
        this.description = '';
        this.id = '';
        this.updated_at = '';
        this.created_at = '';
        this.active_access = '';
        this.secret = '';
	this.encoding = 'text';
	this.expiry_alert = '';
    }


    toParams(): any {
        let res: any = {};
        for (let prop in this) {
	    if(prop == "id" || prop == "value" || prop == "type") {
		// do nothing
	    } else {
		res[prop] = this[prop];
	    }
        }

	if(typeof this.secret === "string") {
	    res.secret = this.secret;
	    res.type = SECRET_TYPE.SECRET;
	} else {
	    res.secret = JSON.stringify(this.secret);
	    res.type = SECRET_TYPE.MULTI_SECRET;
	}

        return res;
    }

    /**
     * @param api
     * @returns
     */
    public create(api: MamoriService): Promise<any> {
        return api.create_secret(this.toParams()).then((res: any) => {
            return res[0];
        });
    }

    public restore(api: MamoriService): Promise<any> {
        return api.restore_secret(this.toParams()).then((res: any) => {
            return res[0];
        });
    }


    public restoreWithKey(api: MamoriService, keyName: string): Promise<any> {
        return api.restore_secret(this.toParams(), keyName).then((res: any) => {
            return res[0];
        });
    }


    public delete(api: MamoriService): Promise<any> {
        return api.delete_secret(this.id!).then((res: any) => {
            return res;
        });
    }

    public update(api: MamoriService): Promise<any> {
        return api.update_secret(this.id!, this.toParams()).then((res: any) => {
            return res[0];
        });
    }

    public reveal(api: MamoriService): Promise<any> {
        return api.reveal_secret(this.id!).then((res: any) => {
            return res;
        });
    }

    public exportSecret(api: MamoriService) {
        return api.export_secret(this.name)
            .then((result: any) => {
                if (result && result.length > 0 && result[0].value) {
                    return result[0].value;
                } else {
                    return null;
                }
            });
    }

    public exportSecretWithKey(api: MamoriService, keyName: string) {
        return api.export_secret(this.name, keyName)
            .then((result: any) => {
                if (result && result.length > 0 && result[0].value) {
                    return result[0].value;
                } else {
                    return null;
                }
            });
    }

    public getMultiSecretParts(api: MamoriService) {
        return api.get_secret_parts(this.id!)
            .then((result: any) => {
                if (result && result.parts) {
                    return JSON.parse(result.parts);
                } else {
                    return [];
                }
            });
    }


    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return new SecretPermission().name(this.name).grantee(grantee).grant(api);
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return new SecretPermission().name(this.name).grantee(grantee).revoke(api);
    }

    public withType(value: SECRET_TYPE): Secret {
        this.type = value;
        return this;
    }
    /**
     * @param secret  The secret text
     * @returns
     */
    public withSecret(secret: any): Secret {
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
     * @param host  The host name or IP
     * @returns
     */
    public withHost(host: string): Secret {
        this.hostname = host;
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

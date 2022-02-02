/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService } from './api';
import { SshLoginDesc } from './api';
import { sqlEscape } from './utils';
import { ISerializable } from "./i-serializable";
import { SSHLoginPermission } from './permission';


/**
 * An SshLogin represents a target machine.
 * 
 * Example use:
 * ```javascript
 * await new SshLogin("test")
 *     .at("10.0.2.2", 1122)
 *     .withCredentials('postgres', 'my_key', 'postgres')
 *     .create(api) ;
 * ```
 * or
 * ```javascript
 * await SshLogin.build({
 *     name: "test", 
 *     host: "10.0.2.2", 
 *     port: 1122
 *     user: "postgres",
 *     privateKey: "my_key",
 *     password: "postgres"
 * }).create(api)
 * ```
 */
export class SshLogin implements ISerializable {

    public static getAll(api: MamoriService): Promise<any> {
        return api.select("call ssh_logins()");
    }

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): SshLogin {
        let result = new SshLogin(ds.name);
        result.fromJSON(ds);
        return result;
    }

    name: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    privateKey?: string;

    /**
     * @param name  Unique SshLogin name
     */
    public constructor(name: string) {
        this.name = name;
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


    /**
     * Create a new SshLogin with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        let uri = "ssh://" + this.user + "@" + this.host + (this.port == 22 ? "" : ":" + this.port);
        let query = "CALL ADD_SSH_LOGIN('" + sqlEscape(this.name) + "', '" + sqlEscape(uri) + "', '" + this.privateKey + "', '" + sqlEscape(this.password || "") + "')";
        return api.select(query).then((res: any) => {
            return res[0];
        });
    }

    /**
     * Delete this SshLogin.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        return api.select("CALL DELETE_SSH_LOGIN('" + sqlEscape(this.name) + "')").then((res: any) => {
            return res[0];
        });
    }

    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return new SSHLoginPermission().sshLogin(this.name).grantee(grantee).grant(api);
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return new SSHLoginPermission().sshLogin(this.name).grantee(grantee).revoke(api);
        //return api.revoke_from(grantee, ['SSH'], this.name);
    }

    /**
     * Set the address of the target resource
     * @param host  Required host name or IP address of the target resource
     * @param port  Required listening port of the target resource
     * @returns 
     */
    public at(host: string, port: any): SshLogin {
        this.host = host;
        this.port = port;
        return this;
    }

    /**
     * Set the creadentials to use when connecting to the target resource
     * @param user        Required user name
     * @param privateKey  Required private key name
     * @param password    Optional password
     * @returns 
     */
    public withCredentials(user: string, privateKey: string, password?: string): SshLogin {
        this.user = user;
        this.password = password;
        this.privateKey = privateKey;
        return this;
    }
}

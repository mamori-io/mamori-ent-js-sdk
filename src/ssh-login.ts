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
 *     private_key_name: "my_key",
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

    public id: string;
    public name: string;
    public host?: string;
    public port?: number;
    public user?: string;
    public password?: string;
    public private_key_name?: string;
    public theme_name?: string;

    /**
     * @param name  Unique SshLogin name
     */
    public constructor(name: string) {
        this.id = '';
        this.name = name;
        this.host = '';
        this.port = 22;
        this.user = '';
        this.private_key_name = '';
        this.password = '';
        this.theme_name = '';
    }

    /**
         * Initialize the object from JSON.
         * Call toJSON to see the expected record.
         * @param record JSON record
         * @returns
         */
    fromJSON(record: any) {
        for (let prop in this) {
            try {
                if (record.hasOwnProperty(prop)) {
                    this[prop] = record[prop];
                }
            } catch (e) {

            }
        }

        function getTokens(part: string) {
            let user = "";
            let host = "";
            let port = "22";

            if (part.includes("@")) {
                user = part.split("@")[0];
                let y = part.split("@")[1];
                host = y;
                if (y.includes(":")) {
                    host = y.split(":")[0];
                    port = y.split(":")[1];
                }
            } else {
                host = part;
                if (part.includes(":")) {
                    host = part.split(":")[0];
                    port = part.split(":")[1];
                }
            }
            let payload = { user: user, host: host, port: port };
            return payload;
        };

        if (record.uri) {
            let u = record.uri.replace("ssh://", "");
            let tokens = getTokens(u);
            this.user = tokens.user;
            this.port = Number.parseInt(tokens.port);
            this.host = tokens.host;
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
        let uri = (this.user && this.user.length > 0) ? "ssh://" + this.user + "@" + this.host + (this.port == 22 ? "" : ":" + this.port) :
            "ssh://" + this.host + (this.port == 22 ? "" : ":" + this.port);


        let query = "CALL ADD_SSH_LOGIN('" + sqlEscape(this.name) + "', '" +
            sqlEscape(uri) + "', '" +
            this.private_key_name + "', '" +
            sqlEscape(this.password || "") + "','" +
            sqlEscape(this.theme_name || "") + "')";
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

    public update(api: MamoriService): Promise<any> {
        let uri = (this.user && this.user.length > 0) ? "ssh://" + this.user + "@" + this.host + (this.port == 22 ? "" : ":" + this.port) :
            "ssh://" + this.host + (this.port == 22 ? "" : ":" + this.port);

        return api.select("call update_ssh_login(" +
            sqlEscape(this.id) +
            ", '" +
            sqlEscape(this.name) +
            "', '" +
            sqlEscape(uri) +
            "', '" +
            this.private_key_name +
            "', '" +
            sqlEscape(this.password || "") +
            "', '" +
            sqlEscape(this.theme_name || "") +
            "')"
        ).then((res: any) => {
            return res[0];
        });
    }

    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return new SSHLoginPermission().sshLogin(this.name).grantee(grantee).grant(api);
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return new SSHLoginPermission().sshLogin(this.name).grantee(grantee).revoke(api);
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
     * @param private_key_name  Required private key name
     * @param password    Optional password
     * @returns 
     */
    public withKeyCredentials(user: string, private_key_name: string, password?: string): SshLogin {
        this.user = user;
        this.password = password ? password : '';
        this.private_key_name = private_key_name;
        return this;
    }
    public withPasswordCredentials(user: string, password: string): SshLogin {
        this.user = user;
        this.password = password;
        return this;
    }
}

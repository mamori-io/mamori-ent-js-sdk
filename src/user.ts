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
import { prepareFilter } from './utils';


class UserBase implements ISerializable {
    public constructor() {
    }

    username: string = "";
    email: string = "";
    fullname: string = "";


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
     * All roles granted, directly or indirectly.
     * @param api 
     * @param user  Optional user name. If null, use the logged-in user.
     * @returns Array of arrays of columns 'uuid', 'roleid', 'grantee', 'valid_from', 'valid_until'
     */
    public static async getAllGrantedRoles(api: MamoriService, user?: string): Promise<any> {
        let name = user || api.username || "";
        let result = await api.callAPI("GET", "/v1/roles?recursive=Y&grantee=" + encodeURIComponent(name.toLowerCase()));
        return result.rows;
    }

    /**
     * All roles directly granted.
     * @param api 
     * @param user  Optional user name. If null, use the logged-in user.
     * @returns Array of Role objects
     */
    public static getGrantedRoles(api: MamoriService, user?: string): Promise<any> {
        let name = user || api.username || "";
        return api.callAPI("GET", "/v1/roles?isdef=N&grantee=" + encodeURIComponent(name.toLowerCase()));
    }

    public static clearMFARequests(api: MamoriService, username: string, peer_public_key?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let sql = "CALL CLEAR_AUTHENTICATION_REQUESTS(':USERNAME')".replace(":USERNAME", username);
            api.select(sql).then(() => {
                if (peer_public_key) {
                    return api.wireguard_disconnect_peer(peer_public_key).then(() => {
                        resolve({ success: true, message: "User multi-factor cache and requests cleared." });
                    });
                } else {
                    return api.wireguard_disconnect_user(username).then(() => {
                        resolve({ success: true, message: "User multi-factor cache and requests cleared." });
                    });
                }
            }).catch((error: any) => {
                reject(error.message);
            });
        });
    }

    public lock(api: MamoriService): Promise<any> {
        return api.disable_user(this.username);
    }

    public unlock(api: MamoriService): Promise<any> {
        return api.unlock_user(this.username);
    }
}


/**
  * A Mamori Directory User
  */
export class User extends UserBase {

    /**
     * Searches remote logins
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns users
    */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.users_search(payload);
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns This User configuration
     */
    public static get(api: MamoriService, username: string): Promise<User> {
        return api.user(username).then(result => {
            let u = new User(username).withEmail(result.email).withFullName(result.fullname);
            return u;
        });
    }

    /**
     * @param user fields as json
     * @returns 
     */
    public static build(user: any): User {
        let result = new User(user.username);
        return result;
    }

    /**
     * @param roleid  Unique Role name
     */
    public constructor(name: string) {
        super();
        this.username = name;
        this.email = "";
        this.fullname = "";
    }

    public withEmail(email: string): User {
        this.email = email;
        return this;
    }

    public withFullName(fullname: string): User {
        this.fullname = fullname;
        return this;
    }


    /**
     * Create a new user with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService, password?: string): Promise<any> {

        return api.create_user({
            username: this.username,
            fullname: this.fullname,
            password: password,
            identified_by: "password",
            email: this.email
        });
    }


    /**
     * Delete.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        return api.delete_user(this.username);
    }

    /**
     * Update this user with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public update(api: MamoriService): Promise<any> {
        return api.update_user(this.username, {
            email: this.email,
            fullname: this.fullname,
        });
    }

}



/**
  * A Mamori Directory User
  */
export class DirectoryUser extends UserBase {

    /**
    * Searches remote logins
    * NOTE: Non-admins will only be able to see their granted peers
    * @param api 
    * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
    * @returns users
   */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.callAPI("PUT", "/v1/search/directory_users", payload);
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns This User configuration
     */
    public static get(api: MamoriService, username: string): Promise<User> {
        return api.user(username).then(result => {
            let u = new User(username).withEmail(result.email).withFullName(result.fullname);
            return u;
        });
    }


    /**
     * @param user fields as json
     * @returns 
     */
    public static build(user: any): User {
        let result = new User(user.username);
        return result;
    }

    provider: string;
    /**
     * @param roleid  Unique Role name
     */
    public constructor(provider: string, name: string) {
        super();
        this.username = name;
        this.provider = provider;
        this.email = "";
        this.fullname = "";
    }

    /**
     * Delete.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        return api.callAPI("POST", "/v1/directory_users", { provider: this.provider, username: this.username });
    }

    /**
     * Delete.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        return api.delete_external_user(this.username);
    }




}
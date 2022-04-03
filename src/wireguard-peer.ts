/*
 * Copyright (c) 2022 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService } from './api';
import { ISerializable } from "./i-serializable";
import { hex2a } from './utils';

export class WireGuardPeer implements ISerializable {

    /**
     * Searches peers
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns 
    */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {

        let filters = filter;
        if (filter && filter.length > 1) {
            let ndx = 0;
            filters = {};
            filter.forEach((element: any) => {
                filters[ndx.toString()] = element;
                ndx++
            });
        }
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.search_wireguard_peers(payload).then(result => {

            result.data = result.data.map((row: any) => {
                row.public_key = Buffer.from(hex2a(row.public_key), 'binary').toString('base64');
                row.name = row.userid + "-" + row.device_name;
                return row;
            });
            return result;
        });
    }

    public static disconnectUser(api: MamoriService, username: string): Promise<any> {
        return api.wireguard_disconnect_user(username);
    }

    device_name: string;
    userid: string;
    allocated_ip_address: string | null;
    public_key: string | null;
    id: string | null;

    /**
    * @param name  Unique ip resource name
    */
    public constructor(userId: string, name: string) {
        this.device_name = name;
        this.userid = userId;
        this.allocated_ip_address = null;
        this.public_key = null;
        this.id = null;
    }

    public withUserId(value: string) {
        this.userid = value;
    }

    public withIp(value: string) {
        this.allocated_ip_address = value;
    }

    public withPublicKey(value: string) {
        this.public_key = value;
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
     * Create a new with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        return api.create_wireguard_peer(this);
    }

    /**
     * Delete peer by ID
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        //Get the resource by name
        if (!this.id) throw new Error("id not specified");
        return api.delete_wireguard_peer(this.id);
    }

    public update(api: MamoriService): Promise<any> {
        if (!this.id) throw new Error("id not specified");
        return api.update_wireguard_peer(this);
    }

    /**
     * reset
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public reset(api: MamoriService, notify: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.id) throw new Error("id not specified");
            let peer = { id: this.id, userid: this.userid, device_name: this.device_name };
            api.update_wireguard_peer(peer).then(result => {
                if (notify) {
                    api.send_wireguard_notification(
                        this.userid,
                        this.device_name,
                        result.config
                    ).then(res => {
                        resolve(result);
                    }).catch(e => {
                        reject(e);
                    });
                } else {
                    resolve(result);
                }
            }).catch(e => {
                reject(e);
            });
        });
    }

    public sendNotification(api: MamoriService, config: any): Promise<any> {
        return api.send_wireguard_notification(
            this.userid,
            this.device_name,
            config
        );
    }

    public lock(api: MamoriService): Promise<any> {
        if (!this.id) throw new Error("id not specified");
        return api.lock_wireguard_peer(this.id);
    }

    public unlock(api: MamoriService): Promise<any> {
        if (!this.id) throw new Error("id not specified");
        return api.unlock_wireguard_peer(this.id);
    }

    public disconnect(api: MamoriService): Promise<any> {
        if (!this.public_key) throw new Error("public key not specified");
        return api.wireguard_disconnect_peer(this.public_key);
    }

}
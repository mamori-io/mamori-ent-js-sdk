/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { listenerCount } from 'process';
import { textChangeRangeIsUnchanged } from 'typescript';
import { MamoriService } from './api';
import { ISerializable } from "./i-serializable";

export class IpResource implements ISerializable {

    /**
     * Searches IP resources
     * NOTE: Non-admins will only be able to see their granted IP resources
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
        return api.callAPI("GET", "/v1/ip_resources", payload);
    }


    name: string;
    cidr?: string;
    ports?: string;

    /**
    * @param name  Unique ip resource name
    */
    public constructor(name: string) {
        this.name = name;
        this.cidr = "";
        this.ports = "";
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
    * IP mask
    * @param cidr 192.168.0.0/16
    * @returns IpResource 
    */
    public withCIDR(cidr: string) {
        this.cidr = cidr;
        return this;
    }

    /**
    * @param ports comma separated list of ports, * for all
    * @returns IpResource 
    */
    public withPorts(ports: string) {
        this.ports = ports;
        return this;
    }

    /**
     * Create a new IP Resource with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        return api.callAPI("POST", "/v1/ip_resources", { resource: this });
    }

    /**
     * Delete this IP Resource.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        //Get the resource by name
        return api.callAPI("DELETE", "/v1/ip_resources/" + encodeURIComponent(this.name));
    }

    public update(api: MamoriService, data: any): Promise<any> {
        let rec: any = { cidr: data.cidr, ports: data.ports };
        if (this.name != data.name) {
            rec.name = data.name;
        }
        //Get the resource by name
        return api.callAPI("PUT", "/v1/ip_resources/" + encodeURIComponent(this.name), { resource: rec });
    }




}
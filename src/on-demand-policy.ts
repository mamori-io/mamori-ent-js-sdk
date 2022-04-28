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

export enum POLICY_TYPES {
    POLICY = "policy",
    OTHER = "other"
}


class OnDemandPolicy implements ISerializable {


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
        return api.policies_get_procedures(payload);
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns This User configuration
     */
    public static get(api: MamoriService, name: string): Promise<OnDemandPolicy> {
        return this.list(api, 0, 10, [["procedure_name", "=", name]]);
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

    script: string;
    name: string;
    description: string | null;
    requires: string | null;
    requiresList: string;
    type: POLICY_TYPES;
    request_role: string;
    request_alert: string;
    request_default_message: string;
    endorse_alert: string;
    endorse_alertList: string[];
    endorse_default_message: string;
    endorse_agent_count: string;
    execute_on_endorse: boolean;
    execute_alert: string;
    deny_alert: string;
    parameters: any[];
    public constructor(name: string) {

        this.name = name;
        this.description = null;
        this.script = "";
        this.requires = null;
        this.requiresList = [];

        type: POLICY_TYPES[0],
            request_role: null,
                request_alert: null,
                    request_default_message: null,
                        endorse_alert: null,
                            endorse_alertList: [],
                                endorse_default_message: null,
                                    endorse_agent_count: "1",
                                        execute_on_endorse: false,
                                            execute_alert: null,
                                                deny_alert: null,
    }


}
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
    OTHER = "other",
    RESOURCE = "resource"
}


export class OnDemandPolicy implements ISerializable {


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
    public static get(api: MamoriService, name: string): Promise<any> {
        return new Promise((resolve, reject) => {

            this.list(api, 0, 1, [["name", "=", name]]).then(result => {
                if (result.data.length > 0) {
                    let o = result.data[0];
                    let p = new OnDemandPolicy(o.name).fromJSON(o);
                    p.loadDetails(api).then(r => {
                        resolve(r);
                    }).catch(e => {
                        reject(e);
                    });
                } else {
                    resolve(null);
                }
            });

        });

    }

    public loadDetails(api: MamoriService): Promise<any> {
        return new Promise((resolve, reject) => {
            api.policies_get_procedure_sql(this.name)
                .then((sqlText) => {
                    this.sqlText = sqlText
                        .trim()
                        .replace(/\s+{\s/g, "\n  {{ ")
                        .replace(/\s}\s/g, " }} ");
                    api.policies_get_procedure_parameters(this.name)
                        .then((parameters) => {
                            this.parameters = parameters;
                            resolve(this);
                        }).catch(e => {
                            reject(e);
                        });
                }).catch(e => {
                    reject(e);
                });
        });
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
                if (prop == 'parameters') {
                    this[prop] = JSON.parse(record[prop]);
                } else {
                    this[prop] = record[prop];
                }
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
            if (prop == 'parameters') {
                res[prop] = JSON.stringify(this[prop]);
            } else {
                res[prop] = this[prop];
            }
        }
        return res;
    }

    sqlText: string;
    name: string;
    description: string;
    requires: string;
    type: POLICY_TYPES;
    request_role: string;
    request_alert: string;
    request_default_message: string;
    endorse_alert: string;
    endorse_default_message: string;
    endorse_agent_count: string;
    execute_on_endorse: string;
    execute_alert: string;
    deny_alert: string;
    parameters: any[];
    approval_expiry: string;
    allow_self_endorse: string;

    public constructor(name: string, type?: POLICY_TYPES) {

        this.name = name;
        this.description = "";
        this.sqlText = "";
        this.requires = "";
        this.type = type ? type : POLICY_TYPES.POLICY;
        this.request_role = "";
        this.request_alert = "";
        this.request_default_message = "";
        this.endorse_alert = "";
        this.endorse_default_message = "";
        this.endorse_agent_count = "1";
        this.execute_on_endorse = 'false';
        this.execute_alert = "";
        this.deny_alert = "";
        this.parameters = [];
        this.approval_expiry = "24";
        this.allow_self_endorse = "false";
    }

    public clearParameters() {
        this.parameters = [];
    }

    public addParameter(name: string, description: string, defaultValue: string): any[] {
        this.parameters.push({ name: name, description: description, default_value: defaultValue });
        return this.parameters;
    }

    public deleteParameter(name: string): any[] {
        let index = -1;
        for (let i = 0; this.parameters.length - 1 >= i; i++) {
            if (this.parameters[i].name === name) {
                index = i;
                break;
            }
        }
        if (index > -1) {
            this.parameters.splice(index, 1);
        }
        return this.parameters;
    }

    private prepareParameters(params: any[]): any {
        let res: any = {};
        for (let i = 0; params.length > i; i++) {
            res[i.toString()] = params[i];
        }
        return res;
    }

    public create(api: MamoriService): Promise<any> {
        return api.policies_create_procedure(
            this.name,
            this.parameters.length > 0 ? this.prepareParameters(this.parameters) : null,
            this.requires,
            this.type,
            this.description,
            this.request_role,
            this.request_alert,
            this.request_default_message,
            this.endorse_alert,
            this.endorse_default_message,
            this.endorse_agent_count,
            this.deny_alert,
            this.execute_on_endorse == 'true' ? "true" : "false",
            this.execute_alert,
            this.approval_expiry,
            this.allow_self_endorse == 'true' ? "true" : "false",
            this.sqlText);
    }

    public delete(api: MamoriService) {
        return api.policies_drop_procedure(this.name);
    }

    public update(api: MamoriService) {
        return this.delete(api).then(r => {
            return this.create(api);
        });
    }

    public withScript(lines: string[]) {
        this.sqlText = "BEGIN; " + lines.join(";") + " END"
    }

}
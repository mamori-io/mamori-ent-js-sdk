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
import { base64_encode } from './utils';
import { sexp } from './sexp';

export enum POLICY_TYPES {
    BEFORE_CONNECTION = 'BEFORE CONNECTION',
    AFTER_CONNECTION = 'AFTER CONNECTION',
    BEFORE_EXECUTE = 'BEFORE EXECUTE'
}

export enum POLICY_ACTIONS {
    ALLOW = 'Allow',
    ALLOW_AND_LOG = 'Allow And Log',
    DENY = 'Deny',
    DENY_WITHOUT_LOG = 'Deny Without Log'
}
export enum POLICY_RULE_TYPE {
    ALWAYS = 'Always',
    WHEN = 'When'
}


//        return api.get_current_access_rules({ rule_type: POLICY_TYPES.CONNECTION })

export class PolicyBase implements ISerializable {


    public static get(api: MamoriService, id: Number): Promise<any> {
        let payload: any = { id: id }
        return api.get_current_access_rules(payload);
    }

    public static build(rec: any): ConnectionPolicy {
        let p = new ConnectionPolicy(rec.rule_type, rec.description);
        p.fromJSON(rec);
        return p;
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

    position: string;
    id: string;
    enabled: string;
    description: string;
    alert: string;
    type: POLICY_TYPES;
    rule_type: POLICY_RULE_TYPE;
    rule_sexp: string;
    rule_json: any;
    action: POLICY_ACTIONS;

    public constructor(type: POLICY_TYPES, description: string) {
        this.type = type;
        this.description = description;
        this.rule_sexp = '';
        this.rule_json = null;
        this.position = '';
        this.id = '';
        this.enabled = 'true';
        this.alert = '';
        this.action = POLICY_ACTIONS.DENY;
        this.rule_type = POLICY_RULE_TYPE.WHEN;
    }

    /**
     * Set the position
     * @param action
     * @returns 
     */
    public withAction(action: POLICY_ACTIONS): PolicyBase {
        this.action = action;
        return this;
    }

    /**
     * Set the rule type
     * @param type
     * @returns 
     */
    public withRuleType(type: POLICY_RULE_TYPE): PolicyBase {
        this.rule_type = type;
        return this;
    }

    /**
     * Set the position
     * @param position
     * @returns 
     */
    public withPosition(position: number): PolicyBase {
        this.position = position.toString();
        return this;
    }

    public withRuleSEXP(rule: string): PolicyBase {
        this.rule_sexp = rule;
        return this;
    }
    public withRuleJSON(rule: any): PolicyBase {
        this.rule_json = rule;
        return this;
    }

    public withAlert(alert: string): PolicyBase {
        this.alert = alert;
        return this;
    }

    public withEnabled(enabled: boolean): PolicyBase {
        this.enabled = enabled ? 'true' : 'false';
        return this;
    }

    private prepare(id?: string): any {
        let rec: any = {
            type: this.type,
            clause: this.rule_json ? this.rule_json : { action: this.action, format: 'sql', condition: { clause_type: this.rule_type, clauses: this.rule_sexp } },
            description: this.description,
            position: Number(this.position),
            alert: this.alert,
            enabled: this.enabled == 'true'
        };
        if (id && id != '') {
            rec.id = Number(id);
        }
        return rec;
    }

    public create(api: MamoriService): Promise<any> {
        let payload = this.prepare();
        return api.callAPI("POST", "/v1/access_rules", payload);
    }

    public delete(api: MamoriService): Promise<any> {
        return api.callAPI("DELETE", "/v1/access_rules/" + this.id);
    }

    public update(api: MamoriService): Promise<any> {
        let payload = this.prepare(this.id);
        return api.callAPI("PUT", "/v1/access_rules/" + this.id, payload);
    }




}

export class ConnectionPolicy extends PolicyBase {
    /**
    * Search before connection policies
    * NOTE: Non-admins will only be able to see their granted peers
    * @param api 
    * @returns users
   */
    public static listBefore(api: MamoriService, filter?: any): Promise<any> {
        let payload: any = filter ? filter : {};
        payload.rule_type = POLICY_TYPES.BEFORE_CONNECTION;
        return api.get_current_access_rules(payload);
    }

    /**
     * Search after connection policies
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @returns users
    */
    public static listAfter(api: MamoriService, filter?: any): Promise<any> {
        let payload: any = filter ? filter : {};
        payload.rule_type = POLICY_TYPES.AFTER_CONNECTION;
        return api.get_current_access_rules(payload);
    }
}

export class StatementPolicy extends PolicyBase {
    /**
    * Search before execute policies
    * NOTE: Non-admins will only be able to see their granted peers
    * @param api 
    * @returns users
   */
    public static list(api: MamoriService, filter?: any): Promise<any> {
        let payload: any = filter ? filter : {};
        payload.rule_type = POLICY_TYPES.BEFORE_EXECUTE;
        return api.get_current_access_rules(payload);
    }

    public constructor(description: string) {
        super(POLICY_TYPES.BEFORE_EXECUTE, description);
    }
}
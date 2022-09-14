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
import { base64_decode, base64_encode } from './utils';
const sexp = require('sexp');

export enum POLICY_TYPES {
    POLICY = "policy",
    OTHER = "other"
}

export enum ALERT_TYPE {
    EMAIL = "email",
    HTTP = "http",
    NOTIFICATION = "notification"
}

export enum HTTP_OPERATION {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE"
}

export enum NOTIFICATION_TYPE {
    MESSAGE = "Message",
    PUSH = "PushMessage"
}


export class AlertChannel implements ISerializable {

    private static describe(action: any) {
        switch (action.name) {
            case ALERT_TYPE.EMAIL:
                return (
                    "Send email to " +
                    action.email_params[0] +
                    " with subject '" +
                    action.email_params[1] +
                    "'"
                );
            case ALERT_TYPE.HTTP:
                let u = new URL(action.http_params[1]);
                return (
                    "Perform " +
                    u.protocol.replace(":", "") +
                    " " +
                    action.http_params[0] +
                    " request to " +
                    u.host +
                    " at " +
                    u.pathname
                );
            case ALERT_TYPE.NOTIFICATION:
                return "Send a notification to " + action.notification_params[0];
            default:
                return "UNKNOWN ACTION " + action.name;
        }
    }

    private static process(item: any, counter: number) {

        let actions = sexp("(" + item.action + ")")
            .map((item: any) => {
                let n = item.shift();
                let result: any = { name: n.toUpperCase(), key: counter++ };
                result[n.toLowerCase() + "_params"] = item.map((s: any) =>
                    s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"')
                );
                return result;
            })
            .map((item: any) => {
                for (let t of Object.values(ALERT_TYPE)) {
                    let n = t + "_params";

                    if (!item[n]) {
                        item[n] = new Array();
                    }
                }
                return item;
            });

        item.description = actions.map(AlertChannel.describe).join(" then ");

        item.actions = actions;

        return item;
    }

    private static encode_actions(actions: any) {
        return actions
            .map((item: any) => {
                return (
                    "(" +
                    item.name +
                    " " +
                    item[item.name.toLowerCase() + "_params"]
                        .map(JSON.stringify)
                        .join(" ") +
                    ")"
                );
            })
            .join("");
    }


    /**
     * Searches on demand policies
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @returns users
    */
    public static list(api: MamoriService): Promise<any> {
        return api.alerts().then((items) => {
            let counter = 0;
            return items.map((item: any) => {
                return AlertChannel.process(item, counter);
            });
        });
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns This User configuration
     */
    public static get(api: MamoriService, name: string): Promise<any> {
        return this.list(api).then(result => {
            let r = result.filter((item: any) => item.name === name);
            if (r.length > 0) {
                let x = r[0];
                return new AlertChannel(x.name).fromJSON(x);
            }
            else {
                return null;
            }
        })
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

    id: number | null;
    name: string;
    actions: any[];

    public constructor(name: string) {
        this.id = null;
        this.name = name;
        this.actions = [];
    }


    public create(api: MamoriService): Promise<any> {
        let payload = { name: this.name, action: AlertChannel.encode_actions(this.actions) };
        return api.create_alert(payload);
    }

    public delete(api: MamoriService): Promise<any> {
        return api.delete_alert(this.id!)
    }

    public update(api: MamoriService): Promise<any> {
        let payload = { name: this.name, action: AlertChannel.encode_actions(this.actions) };
        return api.update_alert(this.id!, payload);
    }

    public addEmailAlert(emails: string, subject: string, message: string): any {
        let payload = { name: ALERT_TYPE.EMAIL, email_params: new Array(3) };
        payload.email_params[0] = emails;
        payload.email_params[1] = subject;
        payload.email_params[2] = message;
        this.actions.push(payload);
        return this.actions;
    }

    public addHTTPAlert(type: HTTP_OPERATION, header: string, url: string, body: string, contentType: string): any {
        let payload = { name: ALERT_TYPE.HTTP, http_params: new Array(5) };
        payload.http_params[0] = type;
        payload.http_params[1] = url;
        payload.http_params[2] = base64_encode(body);
        payload.http_params[3] = contentType;
        payload.http_params[4] = header;
        this.actions.push(payload);
        return this.actions;
    }

    public addPushNotificationAlert(recipient: string, message: string): any {
        let payload = { name: ALERT_TYPE.NOTIFICATION, notification_params: new Array(3) };
        payload.notification_params[0] = recipient;
        payload.notification_params[1] = NOTIFICATION_TYPE.PUSH;
        payload.notification_params[2] = message;
        this.actions.push(payload);
        return this.actions;
    }

    public addMessageAlert(recipient: string, message: string): any {
        let payload = { name: ALERT_TYPE.NOTIFICATION, notification_params: new Array(3) };
        payload.notification_params[0] = recipient;
        payload.notification_params[1] = NOTIFICATION_TYPE.MESSAGE;
        payload.notification_params[2] = message;
        this.actions.push(payload);
        return this.actions;
    }
}
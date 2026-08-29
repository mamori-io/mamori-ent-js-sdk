/*
 * Copyright (c) 2026 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService } from './api';
import { ISerializable } from "./i-serializable";

export enum EVENT_HANDLER_TYPE {
    TRIGGER = "trigger",
    RULE = "rule",
    POLICY_DATA = "policy_data",
    HTTP_REQUEST = "http_request",
    HTTP_RESPONSE = "http_response",
    TEXT_FRAME = "text_frame",
    REQUEST = "request",
}

export class EventHandler implements ISerializable {

    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let payload: any = { skip: from, take: to };
        if (filter) {
            payload.filter = filter;
        }
        return api.callAPI("GET", "/v1/event_handlers", payload);
    }

    public static getByName(api: MamoriService, name: string, type?: string): Promise<EventHandler | null> {
        return EventHandler.list(api, 0, 500).then((data: any) => {
            let rows = data && data.data ? data.data : (Array.isArray(data) ? data : []);
            let match = rows.find((row: any) => {
                if (!row || row.name !== name) {
                    return false;
                }
                return type ? row.type === type : true;
            });
            return match ? EventHandler.build(match) : null;
        });
    }

    public static build(ds: any): EventHandler {
        let result = new EventHandler(ds.name, ds.type, ds.body || "");
        result.fromJSON(ds);
        return result;
    }

    id?: number;
    name: string;
    type: string;
    language: string;
    body: string;

    public constructor(name: string, type: string, body: string = "") {
        this.name = name;
        this.type = type;
        this.body = body;
        this.language = "text/javascript";
        this.id = undefined;
    }

    fromJSON(record: any) {
        for (let prop in this) {
            if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }

    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            res[prop] = this[prop];
        }
        return res;
    }

    public withBody(body: string): EventHandler {
        this.body = body;
        return this;
    }

    public create(api: MamoriService): Promise<any> {
        return api.callAPI("POST", "/v1/event_handlers", {
            id: "",
            name: this.name,
            type: this.type,
            body: this.body,
            language: this.language,
        });
    }

    public update(api: MamoriService): Promise<any> {
        return api.callAPI("PUT", "/v1/event_handlers/" + this.id, {
            id: this.id,
            name: this.name,
            type: this.type,
            body: this.body,
            language: this.language,
        });
    }

    public delete(api: MamoriService): Promise<any> {
        if (this.id) {
            return api.callAPI("DELETE", "/v1/event_handlers/" + this.id);
        }
        return EventHandler.getByName(api, this.name, this.type).then((found) => {
            if (!found || !found.id) {
                throw new Error("event handler not found: " + this.name);
            }
            return found.delete(api);
        });
    }

    /**
     * Run the handler with a JSON payload (trigger, rule, and policy_data only).
     * When body is set on this instance it is sent so unsaved editor content can be tested.
     */
    public test(api: MamoriService, payload: any, body?: string): Promise<any> {
        let rec: any = {
            type: this.type,
            name: this.name,
            payload: payload,
        };
        let script = body !== undefined ? body : this.body;
        if (script) {
            rec.body = script;
        }
        return api.callAPI("POST", "/v1/event_handlers/test", rec);
    }
}

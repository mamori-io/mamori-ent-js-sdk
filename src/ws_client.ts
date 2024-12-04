/*
 * Copyright (c) 2024 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { Eventable } from './eventable';
import { WebSocket } from 'ws';

type PromiseCallback = (value: any) => void;

// a counter to give use the next message id
let message_id_counter = 1;

class RequestCallbackHolder {
    id: number;
    resolve: PromiseCallback;
    reject: PromiseCallback;
    isStream: boolean;

    constructor(id: number, resolve: PromiseCallback, reject: PromiseCallback, isStream: boolean = false) {
        this.id = id;
        this.resolve = resolve;
        this.reject = reject;
        this.isStream = isStream;
    }
}

export class MamoriWebsocketClient extends Eventable {
    private sock: WebSocket | null = null;
    private requests: RequestCallbackHolder[] = [];
    private authtoken: string | null = null;

    public connect(url: string, username: string, password: string, options: any = {}, onclose: PromiseCallback | null = null): Promise<MamoriWebsocketClient> {
        return new Promise<MamoriWebsocketClient>((resolve, reject) => {
            if (this.sock != null) {
                throw "already connected";
            }

            this.authtoken = options.authtoken;

            this.sock = new WebSocket(url, { rejectUnauthorized: false });
            this.sock.addEventListener("open", (_event) => {
                if (this.authtoken) {
                    resolve(this);
                } else {
                    this.sendRequest({
                        command: "authenticate",
                        options: { ...options, ...{ user: username, password_encrypted: Buffer.from(password).toString('base64') } }
                    }).then((result) => {
                        // save off the authtoken for future requests
                        this.authtoken = result.task.authtoken;

                        resolve(this);
                    }).catch((event) => {
                        reject(event);
                    });
                }
            });

            this.sock.addEventListener("message", (event) => {
                let response = JSON.parse(event.data.toString());
                this.requests = this.requests.filter((req) => {
                    if (req.id === Number(response.task.id)) {
                        if (response.error) {
                            req.reject(response);
                        } else {
                            req.resolve(response);
                        }

                        return req.isStream && !response.complete;
                    }

                    return true;
                });

            });

            this.sock.addEventListener("error", (event) => {
                reject(event);
                // a socket error occurred, so reject any pending requests
                for (let req of this.requests) {
                    req.reject(event);
                }
                this.requests = [];

                this.disconnect();
            });

            this.sock.addEventListener("close", (event) => {
                this.sock = null;
                this.requests = [];

                if (onclose) {
                    onclose(event);
                }
            });
        });
    }

    public disconnect() {
        if (this.sock) {
            this.sock.close();
        }

        this.sock = null;
        this.requests = [];
    }

    public sendRequest(req: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (!req.id) {
                req.id = message_id_counter++;
            }
            let handler = new RequestCallbackHolder(req.id, resolve, reject);
            if (this.authtoken) {
                req.authtoken = this.authtoken;
            }

            this.requests.push(handler);
            this.sock!.send(JSON.stringify(req));
        });
    }

    public query(sql: string, options: any = {}): Promise<any> {
        return this.sendRequest({
            command: "query",
            statement: sql,
            options: options
        });
    }

    public websql(sql: string, options: any = {}): Promise<any> {
        return this.sendRequest({
            command: "websql",
            statement: sql,
            options: options
        });
    }

    public websql_config(options: any = {}): Promise<any> {
        return this.sendRequest({
            command: "websql_config",
            options: options
        });
    }

    public next(id: number): Promise<any> {
        return this.sendRequest({
            command: "next",
            id: Number(id)
        });
    }

    public cancel(id: number): Promise<any> {
        return this.sendRequest({
            command: "cancel",
            id: Number(id)
        });
    }

    public queryRows(sql: string, options: any = {}): Promise<any> {
        return this.query(sql, options).then((result) => {
            let cols = result.meta.map((c: any) => c.name.toLowerCase());

            return result.rows.map((data: any) => {
                let row: any = {};
                for (let i = 0; i < cols.length; i++) {
                    row[cols[i]] = data[i];
                }

                return row;
            });
        });
    }

    public execute(sql: string, options: any = {}): Promise<any> {
        return this.sendRequest({
            command: "execute",
            statement: sql,
            options: options
        });
    }

    public tail(logger: string, callback: PromiseCallback): number {
        let req = {
            id: message_id_counter++,
            authtoken: this.authtoken,
            command: "tail",
            logger
        };
        let holder = new RequestCallbackHolder(req.id, callback, callback, true);
        this.requests.push(holder);
        this.sock!.send(JSON.stringify(req));

        return req.id;
    }

    public async *select(sql: string, options: any = {}): AsyncGenerator<any, void, unknown> {

        let resp = await this.query(sql, options);
        let cols = resp.meta.map((c: any) => c.name);
        let taskId = Number(resp.task.id);

        while (resp.rows.length > 0 && !resp.complete) {
            let row = resp.rows.shift()
            let value: any = {};
            for (let i = 0; i < cols.length; i++) {
                value[cols[i]] = row[i];
            }

            yield value;

            if (resp.rows.length == 0 && !resp.complete) {
                resp = await this.next(taskId);
            }

        }
    }
}

/*
 * Copyright (c) 2024 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
export type EventCallback = (data: any) => void;
export interface EventCallbacks {
    [key: string]: EventCallback[];
}


export class Eventable {
    private _handlers: EventCallbacks = {};


    public on(name: string, handler: EventCallback): void {
        let handlers = this._handlers[name];
        if (!handlers) {
            handlers = [];
            this._handlers[name] = handlers;
        }

        handlers.push(handler);
    }

    public off(name: string, handler: EventCallback): void {
        let handlers = this._handlers[name];
        if (handlers) {
            this._handlers[name] = handlers.filter(h => h != handler);
        }
    }

    protected trigger(name: string, data: any): void {
        let handlers = this._handlers[name];
        if (handlers) {
            handlers.slice(0).forEach(h => h(data))
        }
    }

}

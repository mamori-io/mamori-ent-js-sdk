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

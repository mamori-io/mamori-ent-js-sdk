/**
 * Phoenix Channels JavaScript client
 *
 * ## Socket Connection
 *
 * A single connection is established to the server and
 * channels are multiplexed over the connection.
 * Connect to the server using the `Socket` class:
 *
 * ```javascript
 *     let socket = new Socket("/socket", {params: {userToken: "123"}})
 *     socket.connect()
 * ```
 *
 * The `Socket` constructor takes the mount point of the socket,
 * the authentication params, as well as options that can be found in
 * the Socket docs, such as configuring the `LongPoll` transport, and
 * heartbeat.
 *
 * ## Channels
 *
 * Channels are isolated, concurrent processes on the server that
 * subscribe to topics and broker events between the client and server.
 * To join a channel, you must provide the topic, and channel params for
 * authorization. Here's an example chat room example where `"new_msg"`
 * events are listened for, messages are pushed to the server, and
 * the channel is joined with ok/error/timeout matches:
 *
 * ```javascript
 *     let channel = socket.channel("room:123", {token: roomToken})
 *     channel.on("new_msg", msg => console.log("Got message", msg) )
 *     $input.onEnter( e => {
 *       channel.push("new_msg", {body: e.target.val}, 10000)
 *        .receive("ok", (msg) => console.log("created message", msg) )
 *        .receive("error", (reasons) => console.log("create failed", reasons) )
 *        .receive("timeout", () => console.log("Networking issue...") )
 *     })
 *     channel.join()
 *       .receive("ok", ({messages}) => console.log("catching up", messages) )
 *       .receive("error", ({reason}) => console.log("failed join", reason) )
 *       .receive("timeout", () => console.log("Networking issue. Still waiting...") )
 *```
 *
 * ## Joining
 *
 * Creating a channel with `socket.channel(topic, params)`, binds the params to
 * `channel.params`, which are sent up on `channel.join()`.
 * Subsequent rejoins will send up the modified params for
 * updating authorization params, or passing up last_message_id information.
 * Successful joins receive an "ok" status, while unsuccessful joins
 * receive "error".
 *
 * ## Duplicate Join Subscriptions
 *
 * While the client may join any number of topics on any number of channels,
 * the client may only hold a single subscription for each unique topic at any
 * given time. When attempting to create a duplicate subscription,
 * the server will close the existing channel, log a warning, and
 * spawn a new channel for the topic. The client will have their
 * `channel.onClose` callbacks fired for the existing channel, and the new
 * channel join will have its receive hooks processed as normal.
 *
 * ## Pushing Messages
 *
 * From the previous example, we can see that pushing messages to the server
 * can be done with `channel.push(eventName, payload)` and we can optionally
 * receive responses from the push. Additionally, we can use
 * `receive("timeout", callback)` to abort waiting for our other `receive` hooks
 *  and take action after some period of waiting. The default timeout is 5000ms.
 *
 *
 * ## Socket Hooks
 *
 * Lifecycle events of the multiplexed connection can be hooked into via
 * `socket.onError()` and `socket.onClose()` events, ie:
 *
 * ```javascript
 *     socket.onError( () => console.log("there was an error with the connection!") )
 *     socket.onClose( () => console.log("the connection dropped") )
 * ```
 *
 *
 * ## Channel Hooks
 *
 * For each joined channel, you can bind to `onError` and `onClose` events
 * to monitor the channel lifecycle, ie:
 *
 * ```javascript
 *     channel.onError( () => console.log("there was an error!") )
 *     channel.onClose( () => console.log("the channel has gone away gracefully") )
 * ```
 *
 * ### onError hooks
 *
 * `onError` hooks are invoked if the socket connection drops, or the channel
 * crashes on the server. In either case, a channel rejoin is attempted
 * automatically in an exponential backoff manner.
 *
 * ### onClose hooks
 *
 * `onClose` hooks are invoked only in two cases. 1) the channel explicitly
 * closed on the server, or 2). The client explicitly closed, by calling
 * `channel.leave()`
 *
 *
 * ## Presence
 *
 * The `Presence` object provides features for syncing presence information
 * from the server with the client and handling presences joining and leaving.
 *
 * ### Syncing initial state from the server
 *
 * `Presence.syncState` is used to sync the list of presences on the server
 * with the client's state. An optional `onJoin` and `onLeave` callback can
 * be provided to react to changes in the client's local presences across
 * disconnects and reconnects with the server.
 *
 * `Presence.syncDiff` is used to sync a diff of presence join and leave
 * events from the server, as they happen. Like `syncState`, `syncDiff`
 * accepts optional `onJoin` and `onLeave` callbacks to react to a user
 * joining or leaving from a device.
 *
 * ### Listing Presences
 *
 * `Presence.list` is used to return a list of presence information
 * based on the local state of metadata. By default, all presence
 * metadata is returned, but a `listBy` function can be supplied to
 * allow the client to select which metadata to use for a given presence.
 * For example, you may have a user online from different devices with
 * a metadata status of "online", but they have set themselves to "away"
 * on another device. In this case, the app may choose to use the "away"
 * status for what appears on the UI. The example below defines a `listBy`
 * function which prioritizes the first metadata which was registered for
 * each user. This could be the first tab they opened, or the first device
 * they came online from:
 *
 * ```javascript
 *     let state = {}
 *     state = Presence.syncState(state, stateFromServer)
 *     let listBy = (id, {metas: [first, ...rest]}) => {
 *       first.count = rest.length + 1 // count of this user's presences
 *       first.id = id
 *       return first
 *     }
 *     let onlineUsers = Presence.list(state, listBy)
 * ```
 *
 *
 * ### Example Usage
 *```javascript
 *     // detect if user has joined for the 1st time or from another tab/device
 *     let onJoin = (id, current, newPres) => {
 *       if(!current){
 *         console.log("user has entered for the first time", newPres)
 *       } else {
 *         console.log("user additional presence", newPres)
 *       }
 *     }
 *     // detect if user has left from all tabs/devices, or is still present
 *     let onLeave = (id, current, leftPres) => {
 *       if(current.metas.length === 0){
 *         console.log("user has left from all devices", leftPres)
 *       } else {
 *         console.log("user left from a device", leftPres)
 *       }
 *     }
 *     let presences = {} // client's initial empty presence state
 *     // receive initial presence data from server, sent after join
 *     myChannel.on("presence_state", state => {
 *       presences = Presence.syncState(presences, state, onJoin, onLeave)
 *       displayUsers(Presence.list(presences))
 *     })
 *     // receive "presence_diff" from server, containing join/leave events
 *     myChannel.on("presence_diff", diff => {
 *       presences = Presence.syncDiff(presences, diff, onJoin, onLeave)
 *       this.setState({users: Presence.list(room.presences, listBy)})
 *     })
 * ```
 * @module phoenix
 */


import { w3cwebsocket as WebSocket, IMessageEvent as MessageEvent } from "websocket";

const VSN = "2.0.0"
const SOCKET_STATES = {connecting: 0, open: 1, closing: 2, closed: 3}
const DEFAULT_TIMEOUT = 10000
const WS_CLOSE_NORMAL = 1000
const CHANNEL_STATES = {
    closed: "closed",
    errored: "errored",
    joined: "joined",
    joining: "joining",
    leaving: "leaving",
}
const CHANNEL_EVENTS = {
    close: "phx_close",
    error: "phx_error",
    join: "phx_join",
    reply: "phx_reply",
    leave: "phx_leave"
}
const CHANNEL_LIFECYCLE_EVENTS = [
    CHANNEL_EVENTS.close,
    CHANNEL_EVENTS.error,
    CHANNEL_EVENTS.join,
    CHANNEL_EVENTS.reply,
    CHANNEL_EVENTS.leave
]
const TRANSPORTS = {
    websocket: "websocket"
}

interface ChannelBinding {
    event: string;
    callback: (payload?: any, ref?: string, joinRef?: string) => void;
}

/**
 * Initializes the Push
 * @param {Channel} channel - The Channel
 * @param {string} event - The event, for example `"phx_join"`
 * @param {Object} payload - The payload, for example `{user_id: 123}`
 * @param {number} timeout - The push timeout in milliseconds
 */
class Push {
    channel: Channel;
    event: string;
    payload: any;
    receivedResp: any;
    timeoutTimer: any;
    recHooks: any[];
    sent: boolean;
    refEvent: string;
    ref: string;
    timeout: number;

    constructor(channel: Channel, event: string, payload: any, timeout: number){
        this.channel      = channel
        this.event        = event
        this.payload      = payload || {}
        this.receivedResp = null
        this.timeout      = timeout
        this.timeoutTimer = null
        this.recHooks     = []
        this.sent         = false
        this.refEvent = ""
        this.ref = ""
    }

    /**
     *
     * @param {number} timeout
     */
    resend(timeout: number){
        this.timeout = timeout
        this.reset()
        this.send()
    }

    /**
     *
     */
    send(){
        if(this.hasReceived("timeout")) {
            return
        }

        this.startTimeout()
        this.sent = true
        this.channel.socket.push({
            topic: this.channel.topic,
            event: this.event,
            payload: this.payload,
            ref: this.ref,
            join_ref: this.channel.joinRef()
        })
    }

    /**
     *
     * @param {*} status
     * @param {*} callback
     */
    receive(status: string, callback: (response?: any) => void){
        if(this.hasReceived(status)){
            callback(this.receivedResp.response)
        }

        this.recHooks.push({status, callback})
        return this
    }


    // private

    reset(){
        this.cancelRefEvent()
        this.ref          = ""
        this.refEvent     = ""
        this.receivedResp = null
        this.sent         = false
    }

    matchReceive({status, response, ref}: {status: any; response: any; ref: any}) {
        this.recHooks.filter( h => h.status === status )
            .forEach( h => h.callback(response) )
    }

    cancelRefEvent() {
        if(!this.refEvent){ return }
        this.channel.off(this.refEvent)
    }

    cancelTimeout(){
        clearTimeout(this.timeoutTimer)
        this.timeoutTimer = null
    }

    startTimeout(){
        if(this.timeoutTimer){
            this.cancelTimeout()
        }

        this.ref      = this.channel.socket.makeRef()
        this.refEvent = this.channel.replyEventName(this.ref)

        this.channel.on(this.refEvent, payload => {
            this.cancelRefEvent()
            this.cancelTimeout()
            this.receivedResp = payload
            this.matchReceive(payload)
        })

        this.timeoutTimer = setTimeout(() => {
            this.trigger("timeout", {})
        }, this.timeout)
    }

    hasReceived(status: string){
        return this.receivedResp && this.receivedResp.status === status
    }

    trigger(status: string, response: any){
        this.channel.trigger(this.refEvent, {status, response})
    }
}

/**
 *
 * @param {string} topic
 * @param {Object} params
 * @param {Socket} socket
 */
export class Channel {
    state: string;
    params: Object;
    bindings: ChannelBinding[];
    timeout: number;
    joinedOnce: boolean;
    joinPush: Push;
    pushBuffer: any[];
    rejoinTimer: Timer;
    socket: Socket;
    topic: string;

    constructor(topic: string, params: Object, socket: Socket) {
        this.state       = CHANNEL_STATES.closed
        this.topic       = topic
        this.params      = params || {}
        this.socket      = socket
        this.bindings    = []
        this.timeout     = this.socket.timeout
        this.joinedOnce  = false
        this.joinPush    = new Push(this, CHANNEL_EVENTS.join, this.params, this.timeout)
        this.pushBuffer  = []
        this.rejoinTimer  = new Timer(
            () => this.rejoinUntilConnected(),
            this.socket.reconnectAfterMs
        )
        this.joinPush.receive("ok", () => {
            this.state = CHANNEL_STATES.joined
            this.rejoinTimer.reset()
            this.pushBuffer.forEach( pushEvent => pushEvent.send() )
            this.pushBuffer = []
        })
        this.onClose( () => {
            this.rejoinTimer.reset()
            this.socket.log("channel", `close ${this.topic} ${this.joinRef()}`)
            this.state = CHANNEL_STATES.closed
            this.socket.remove(this)
        })
        this.onError( reason => { if(this.isLeaving() || this.isClosed()){ return }
                                  this.socket.log("channel", `error ${this.topic}`, reason)
                                  this.state = CHANNEL_STATES.errored
                                  this.rejoinTimer.scheduleTimeout()
                                })
        this.joinPush.receive("timeout", () => { if(!this.isJoining()){ return }
                                                 this.socket.log("channel", `timeout ${this.topic} (${this.joinRef()})`, this.joinPush.timeout)
                                                 let leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, this.timeout)
                                                 leavePush.send()
                                                 this.state = CHANNEL_STATES.errored
                                                 this.joinPush.reset()
                                                 this.rejoinTimer.scheduleTimeout()
                                               })
        this.on(CHANNEL_EVENTS.reply, (payload, ref) => {
            this.trigger(this.replyEventName(ref!), payload)
        })
    }

    rejoinUntilConnected(){
        this.rejoinTimer.scheduleTimeout()
        if(this.socket.isConnected()){
            this.rejoin()
        }
    }

    join(timeout = this.timeout){
        if(this.joinedOnce){
            throw(`tried to join multiple times. 'join' can only be called a single time per channel instance`)
        } else {
            this.joinedOnce = true
            this.rejoin(timeout)
            return this.joinPush
        }
    }

    onClose(callback: (payload?: any, ref?: string, joinRef?: string) => void){ this.on(CHANNEL_EVENTS.close, callback) }

    onError(callback: (payload?: any, ref?: string, joinRef?: string) => void){
        this.on(CHANNEL_EVENTS.error, reason => callback(reason) )
    }

    on(event: string, callback: (payload?: any, ref?: string, joinRef?: string) => void){ this.bindings.push({event, callback}) }

    off(event: string){ this.bindings = this.bindings.filter( bind => bind.event !== event ) }

    canPush(){ return this.socket.isConnected() && this.isJoined() }

    push(event: string, payload: any, timeout = this.timeout){
        if(!this.joinedOnce){
            throw(`tried to push '${event}' to '${this.topic}' before joining. Use channel.join() before pushing events`)
        }
        let pushEvent = new Push(this, event, payload, timeout)
        if(this.canPush()){
            pushEvent.send()
        } else {
            pushEvent.startTimeout()
            this.pushBuffer.push(pushEvent)
        }

        return pushEvent
    }

    /** Leaves the channel
     *
     * Unsubscribes from server events, and
     * instructs channel to terminate on server
     *
     * Triggers onClose() hooks
     *
     * To receive leave acknowledgements, use the a `receive`
     * hook to bind to the server ack, ie:
     *
     * ```javascript
     *     channel.leave().receive("ok", () => alert("left!") )
     * ```
     */
    leave(timeout = this.timeout){
        this.state = CHANNEL_STATES.leaving
        let onClose = () => {
            this.socket.log("channel", `leave ${this.topic}`)
            this.trigger(CHANNEL_EVENTS.close, "leave")
        }
        let leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout)
        leavePush.receive("ok", () => onClose() )
            .receive("timeout", () => onClose() )
        leavePush.send()
        if(!this.canPush()){ leavePush.trigger("ok", {}) }

        return leavePush
    }

    /**
     * Overridable message hook
     *
     * Receives all events for specialized message handling
     * before dispatching to the channel callbacks.
     *
     * Must return the payload, modified or unmodified
     */
    onMessage(event: string, payload: any, ref?: string, joinRef?: string){ return payload }


    // private

    isMember(topic: string, event: string, payload: string, joinRef?: string){
        if(this.topic !== topic){ return false }
        let isLifecycleEvent = CHANNEL_LIFECYCLE_EVENTS.indexOf(event) >= 0

        if(joinRef && isLifecycleEvent && joinRef !== this.joinRef()){
            this.socket.log("channel", "dropping outdated message", {topic, event, payload, joinRef})
            return false
        } else {
            return true
        }
    }

    joinRef(){ return this.joinPush.ref }

    sendJoin(timeout: number){
        this.state = CHANNEL_STATES.joining
        this.joinPush.resend(timeout)
    }

    rejoin(timeout = this.timeout){ if(this.isLeaving()){ return }
                                    this.sendJoin(timeout)
                                  }

    trigger(event: string, payload?: any, ref?: string, joinRef?: string){
        let handledPayload = this.onMessage(event, payload, ref, joinRef)
        if(payload && !handledPayload){ throw("channel onMessage callbacks must return the payload, modified or unmodified") }

        this.bindings.filter( (bind: ChannelBinding) => bind.event === event)
            .map( (bind: ChannelBinding) => bind.callback(handledPayload, ref, joinRef || this.joinRef() || ""))
    }

    replyEventName(ref: string){ return `chan_reply_${ref}` }

    isClosed() { return this.state === CHANNEL_STATES.closed }
    isErrored(){ return this.state === CHANNEL_STATES.errored }
    isJoined() { return this.state === CHANNEL_STATES.joined }
    isJoining(){ return this.state === CHANNEL_STATES.joining }
    isLeaving(){ return this.state === CHANNEL_STATES.leaving }
}

let Serializer = {
    encode(msg: any, callback: (msg: string) => void){
        let payload = [
            msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload
        ]
        return callback(JSON.stringify(payload))
    },

    decode(rawPayload: string, callback: (msg: any) => void){
        let [join_ref, ref, topic, event, payload] = JSON.parse(rawPayload)

        return callback({join_ref, ref, topic, event, payload})
    }
}

function serialize(obj: any, parentKey?: string){
    let queryStr: string[] = [];
    for(var key in obj){ if(!obj.hasOwnProperty(key)){ continue }
      let paramKey = parentKey ? `${parentKey}[${key}]` : key
      let paramVal = obj[key]
      if(typeof paramVal === "object"){
        queryStr.push(serialize(paramVal, paramKey))
      } else {
        queryStr.push(encodeURIComponent(paramKey) + "=" + encodeURIComponent(paramVal))
      }
    }
    return queryStr.join("&")
  }


function appendParams(url: string, params: any){
    if(Object.keys(params).length === 0){ return url }

    let prefix = url.match(/\?/) ? "&" : "?"
    return `${url}${prefix}${serialize(params)}`
}


export interface SocketOptions {
    timeout?: number;
    transport?: any;
    heartbeatIntervalMs?: number;
    reconnectAfterMs?: (tries: number) => number;
    logger?: any;
    longpollerTimeout?: number;
    params?: any;
    decode?: (payload: string, callback: (msg: any) => void) => void;
    encode?: (msg: any, callback: (payload: string) => void) => void;

}

/** Initializes the Socket
 *
 *
 * For IE8 support use an ES5-shim (https://github.com/es-shims/es5-shim)
 *
 * @param {string} endPoint - The string WebSocket endpoint, ie, `"ws://example.com/socket"`,
 *                                               `"wss://example.com"`
 *                                               `"/socket"` (inherited host & protocol)
 * @param {Object} opts - Optional configuration
 * @param {string} opts.transport - The Websocket Transport, for example WebSocket or Phoenix.LongPoll.
 *
 * Defaults to WebSocket with automatic LongPoll fallback.
 * @param {Function} opts.encode - The function to encode outgoing messages.
 *
 * Defaults to JSON:
 *
 * ```javascript
 * (payload, callback) => callback(JSON.stringify(payload))
 * ```
 *
 * @param {Function} opts.decode - The function to decode incoming messages.
 *
 * Defaults to JSON:
 *
 * ```javascript
 * (payload, callback) => callback(JSON.parse(payload))
 * ```
 *
 * @param {number} opts.timeout - The default timeout in milliseconds to trigger push timeouts.
 *
 * Defaults `DEFAULT_TIMEOUT`
 * @param {number} opts.heartbeatIntervalMs - The millisec interval to send a heartbeat message
 * @param {number} opts.reconnectAfterMs - The optional function that returns the millsec reconnect interval.
 *
 * Defaults to stepped backoff of:
 *
 * ```javascript
 *  function(tries){
 *    return [1000, 5000, 10000][tries - 1] || 10000
 *  }
 * ```
 * @param {Function} opts.logger - The optional function for specialized logging, ie:
 * ```javascript
 * logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
 * ```
 *
 * @param {number}  opts.longpollerTimeout - The maximum timeout of a long poll AJAX request.
 *
 * Defaults to 20s (double the server long poll timer).
 *
 * @param {Object}  opts.params - The optional params to pass when connecting
 *
 *
 */
export class Socket {
    stateChangeCallbacks: {
        open: any[];
        close: any[];
        error: any[];
        message: any[];
    };
    channels: Channel[];
    sendBuffer: any[];
    ref: number;
    transport: any;
    heartbeatTimer: any;
    heartbeatIntervalMs: number;
    logger: any;
    longpollerTimeout: number;
    params: any;
    endPoint: string;
    reconnectTimer: Timer;
    conn: any;
    timeout: number;
    reconnectAfterMs: (tries: number) => number;
    pendingHeartbeatRef: string | null;
    decode: (payload: string, callback: (msg: any) => void) => void;
    encode: (msg: any, callback: (payload: string) => void) => void;

    constructor(endPoint: string, opts: SocketOptions = {}){
        this.stateChangeCallbacks = {open: [], close: [], error: [], message: []}
        this.channels             = []
        this.sendBuffer           = []
        this.ref                  = 0
        this.timeout              = opts.timeout || DEFAULT_TIMEOUT
        this.transport            = opts.transport || WebSocket
        this.encode = opts.encode || Serializer.encode
        this.decode = opts.decode || Serializer.decode
        this.heartbeatIntervalMs  = opts.heartbeatIntervalMs || 30000
        this.reconnectAfterMs     = opts.reconnectAfterMs || function(tries){
            return [1000, 2000, 5000, 10000][tries - 1] || 10000
        }
        this.logger               = opts.logger || function(){} // noop
        this.longpollerTimeout    = opts.longpollerTimeout || 20000
        this.params               = opts.params || {}
        this.endPoint             = `${endPoint}/${TRANSPORTS.websocket}`
        this.heartbeatTimer       = null
        this.pendingHeartbeatRef  = null
        this.reconnectTimer       = new Timer(() => {
            this.disconnect(() => this.connect())
        }, this.reconnectAfterMs)
    }

    protocol(){ return location.protocol.match(/^https/) ? "wss" : "ws" }

    endPointURL(){
        let uri = appendParams(appendParams(this.endPoint, this.params), {vsn: VSN})
        if(uri.charAt(0) !== "/"){ return uri }
        if(uri.charAt(1) === "/"){ return `${this.protocol()}:${uri}` }

        return `${this.protocol()}://${location.host}${uri}`
    }

    disconnect(callback?:any, code?: number, reason?: string){
        if(this.conn){
            this.conn.onclose = function(){} // noop
            if(code){ this.conn.close(code, reason || "") } else { this.conn.close() }
            this.conn = null
        }
        callback && callback()
    }

    /**
     *
     * @param {Object} params - The params to send when connecting, for example `{user_id: userToken}`
     */
    connect(params?: any){
        if(params){
            console && console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor")
            this.params = params
        }
        if(this.conn){ return }

        this.conn = new this.transport(this.endPointURL())
        this.conn.timeout   = this.longpollerTimeout
        this.conn.onopen    = () => this.onConnOpen()
        this.conn.onerror   = (error: any) => this.onConnError(error)
        this.conn.onmessage = (event: any) => this.onConnMessage(event)
        this.conn.onclose   = (event: any) => this.onConnClose(event)
    }

    /**
     * Logs the message. Override `this.logger` for specialized logging. noops by default
     * @param {string} kind
     * @param {string} msg
     * @param {Object} data
     */
    log(kind: string, msg: string, data?: Object){ this.logger(kind, msg, data) }

    // Registers callbacks for connection state change events
    //
    // Examples
    //
    //    socket.onError(function(error){ alert("An error occurred") })
    //
    onOpen     (callback: any){ this.stateChangeCallbacks.open.push(callback) }
    onClose    (callback: any){ this.stateChangeCallbacks.close.push(callback) }
    onError    (callback: any){ this.stateChangeCallbacks.error.push(callback) }
    onMessage  (callback: any){ this.stateChangeCallbacks.message.push(callback) }

    onConnOpen(){
        this.log("transport", `connected to ${this.endPointURL()}`)
        this.flushSendBuffer()
        this.reconnectTimer.reset()
        if(!this.conn.skipHeartbeat){
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs)
        }
        this.stateChangeCallbacks.open.forEach( callback => callback() )
    }

    onConnClose(event: string){
        this.log("transport", "close", event)
        this.triggerChanError()
        clearInterval(this.heartbeatTimer)
        this.reconnectTimer.scheduleTimeout()
        this.stateChangeCallbacks.close.forEach( callback => callback(event) )
    }

    onConnError(error: string){
        this.log("transport", error)
        this.triggerChanError()
        this.stateChangeCallbacks.error.forEach( callback => callback(error) )
    }

    triggerChanError(){
        this.channels.forEach( channel => channel.trigger(CHANNEL_EVENTS.error) )
    }

    connectionState(){
        switch(this.conn && this.conn.readyState){
            case SOCKET_STATES.connecting: return "connecting"
            case SOCKET_STATES.open:       return "open"
            case SOCKET_STATES.closing:    return "closing"
            default:                       return "closed"
        }
    }

    isConnected(){ return this.connectionState() === "open" }

    remove(channel: Channel){
        this.channels = this.channels.filter((c: Channel) => c.joinRef() !== channel.joinRef())
    }

    /**
     * Initiates a new channel for the given topic
     *
     * @param {string} topic
     * @param {Object} chanParams - Paramaters for the channel
     * @returns {Channel}
     */
    channel(topic: string, chanParams = {}){
        let chan = new Channel(topic, chanParams, this)
        this.channels.push(chan)
        return chan
    }

    push(data: { topic: string; event: string; payload: any; ref: string; join_ref?: string }){
        let {topic, event, payload, ref, join_ref} = data
        let callback = () => {
            this.encode(data, result => {
                this.conn.send(result)
            })
        }
        this.log("push", `${topic} ${event} (${join_ref}, ${ref})`, payload)
        if(this.isConnected()){
            callback()
        }
        else {
            this.sendBuffer.push(callback)
        }
    }

    /**
     * Return the next message ref, accounting for overflows
     */
    makeRef(): string {
        let newRef = this.ref + 1
        if(newRef === this.ref){ this.ref = 0 } else { this.ref = newRef }

        return this.ref.toString()
    }

    sendHeartbeat(){ if(!this.isConnected()){ return }
                     if(this.pendingHeartbeatRef){
                         this.pendingHeartbeatRef = null
                         this.log("transport", "heartbeat timeout. Attempting to re-establish connection")
                         this.conn.close(WS_CLOSE_NORMAL, "hearbeat timeout")
                         return
                     }
                     this.pendingHeartbeatRef = this.makeRef()
                     this.push({topic: "phoenix", event: "heartbeat", payload: {}, ref: this.pendingHeartbeatRef})
                   }

    flushSendBuffer(){
        if(this.isConnected() && this.sendBuffer.length > 0){
            this.sendBuffer.forEach( callback => callback() )
            this.sendBuffer = []
        }
    }

    onConnMessage(rawMessage: MessageEvent){
        this.decode(rawMessage.data as string, (msg: any) => {
            let {topic, event, payload, ref, join_ref} = msg
            if(ref && ref === this.pendingHeartbeatRef){ this.pendingHeartbeatRef = null }

            this.log("receive", `${payload.status || ""} ${topic} ${event} ${ref && "(" + ref + ")" || ""}`, payload)
            this.channels.filter( channel => channel.isMember(topic, event, payload, join_ref) )
                .forEach( channel => channel.trigger(event, payload, ref, join_ref) )
            this.stateChangeCallbacks.message.forEach( callback => callback(msg) )
        })
    }
}

export var Presence = {

    syncState(currentState: any, newState: any, onJoin: (key: any, currentPresence: any, newPresence: any) => void, onLeave: (key: any, currentPresence: any, leftPresence: any) => void): any{
        let state = this.clone(currentState)
        let joins: any = {}
        let leaves: any = {}

        this.map(state, (key, presence) => {
            if(!newState[key]){
                leaves[key] = presence
            }
        })
        this.map(newState, (key, newPresence) => {
            let currentPresence = state[key]
            if(currentPresence){
                let newRefs = newPresence.metas.map((m: any) => m.phx_ref)
                let curRefs = currentPresence.metas.map((m: any) => m.phx_ref)
                let joinedMetas = newPresence.metas.filter((m: any) => curRefs.indexOf(m.phx_ref) < 0)
                let leftMetas = currentPresence.metas.filter((m: any) => newRefs.indexOf(m.phx_ref) < 0)
                if(joinedMetas.length > 0){
                    joins[key] = newPresence
                    joins[key].metas = joinedMetas
                }
                if(leftMetas.length > 0){
                    leaves[key] = this.clone(currentPresence)
                    leaves[key].metas = leftMetas
                }
            } else {
                joins[key] = newPresence
            }
        })
        return this.syncDiff(state, {joins: joins, leaves: leaves}, onJoin, onLeave)
    },

    syncDiff(currentState: any, {joins, leaves}: {joins: any, leaves: any}, onJoin: (key: any, currentPresence: any, newPresence: any) => void, onLeave: (key: any, currentPresence: any, leftPresence: any) => void): any{
        let state = this.clone(currentState)
        if(!onJoin){ onJoin = function(){} }
        if(!onLeave){ onLeave = function(){} }

        this.map(joins, (key, newPresence) => {
            let currentPresence = state[key]
            state[key] = newPresence
            if(currentPresence){
                state[key].metas.unshift(...currentPresence.metas)
            }
            onJoin(key, currentPresence, newPresence)
        })
        this.map(leaves, (key, leftPresence) => {
            let currentPresence = state[key]
            if(!currentPresence){ return }
            let refsToRemove = leftPresence.metas.map((m: any) => m.phx_ref)
            currentPresence.metas = currentPresence.metas.filter((p:any) => {
                return refsToRemove.indexOf(p.phx_ref) < 0
            })
            onLeave(key, currentPresence, leftPresence)
            if(currentPresence.metas.length === 0){
                delete state[key]
            }
        })
        return state
    },

    list(presences: any[], chooser: (key: any, pres: any) => any): void[]{
        if(!chooser){ chooser = function(key: any, pres: any){ return pres } }

        return this.map(presences, (key, presence) => {
            return chooser(key, presence)
        })
    },

    // private

    map(obj: any, func: (key: any, value: any) => void): void[] {
        return Object.getOwnPropertyNames(obj).map(key => func(key, obj[key]))
    },

    clone(obj: any): any {
        return JSON.parse(JSON.stringify(obj))
    }
}


/**
 *
 * Creates a timer that accepts a `timerCalc` function to perform
 * calculated timeout retries, such as exponential backoff.
 *
 * ## Examples
 *
 * ```javascript
 *    let reconnectTimer = new Timer(() => this.connect(), function(tries){
 *      return [1000, 5000, 10000][tries - 1] || 10000
 *    })
 *    reconnectTimer.scheduleTimeout() // fires after 1000
 *    reconnectTimer.scheduleTimeout() // fires after 5000
 *    reconnectTimer.reset()
 *    reconnectTimer.scheduleTimeout() // fires after 1000
 * ```
 * @param {Function} callback
 * @param {Function} timerCalc
 */
class Timer {
    timer: any;
    tries: number;
    callback: () => void;
    timerCalc: (tries: number) => number;

    constructor(callback: () => void, timerCalc: (tries: number) => number){
        this.callback  = callback
        this.timerCalc = timerCalc
        this.timer     = null
        this.tries     = 0
    }

    reset(){
        this.tries = 0
        clearTimeout(this.timer)
    }

    /**
     * Cancels any previous scheduleTimeout and schedules callback
     */
    scheduleTimeout(){
        clearTimeout(this.timer)

        this.timer = setTimeout(() => {
            this.tries = this.tries + 1
            this.callback()
        }, this.timerCalc(this.tries + 1))
    }
}

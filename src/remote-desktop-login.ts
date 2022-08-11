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
import { RemoteDesktopLoginPermission } from './permission';
import { objectClone, prepareFilter } from './utils';

export enum REMOTE_DESKTOP_PROTOCOL {
    RDP = "rdp",
    VNC = "vnc"
}

export enum LOGIN_PROMPT_MODE {
    MANUAL = "manual",
    OS_PROMPT = "os",
    MAMORI_PROMPT = "mamori"
}

export enum KEYBOARD_LAYOUTS {
    UNSPECIFIED = "",
    BRAZILIAN_PORTUGUESE = "pt-br-qwerty",
    ENGLISH_UK = "en-gb-qwerty",
    ENGLISH_US = "en-us-qwerty",
    FRENCH = "fr-fr-azerty",
    FRENCH_BELGIAN = "fr-be-azerty",
    FRENCH_SWISS = "fr-ch-qwertz",
    GERMAN = "de-de-qwertz",
    GERMAN_SWISS = "de-ch-qwertz",
    HUNGARIAN = "hu-hu-qwertz",
    ITALIAN = "it-it-qwerty",
    JAPANESE = "ja-jp-qwerty",
    NORWEGIAN = "no-no-qwerty",
    SPANISH = "es-es-qwerty",
    SPANISH_LATIN_AMERICA = "es-latam-qwerty",
    SWEDISH = "sv-se-qwerty",
    TURKISH_Q = "tr-tr-qwerty",
    UNICODE_FAILSAFE = "failsafe",
}

export enum CLIPBOARD_MODES {
    PRESERVE = "preserve",
    CONVERT_TO_UNIX_LF = "unix",
    CONVERT_TO_WINDOWS_CRLF = "windows"
}

export enum COLOR_DEPTHS {
    COLORS_256 = 8,
    COLORS_64k = 16,
    COLORS_16M = 24
}

export enum AUTHENTICATION_MODES {
    ANY = "any",
    NETWORK_LEVEL_AUTHENTICATION = "nla",
    EXTENDED_NETWORK_LEVEL_AUTHENTICATION = "nla-ext",
    LEGACY_RDP = "rdp"
}

export class VNC {
    hostname: string;
    port: number;
    username: string | null;
    password: string | null;
    width: number;
    height: number;
    _credentials_required: boolean;
    constructor() {
        this.hostname = "";
        this.port = 3389;
        this.width = 1024;
        this.height = 768;
        this._credentials_required = false;
        this.username = "";
        this.password = "";
    }
}

export class RDP {
    hostname: string;
    port: number;
    username: string | null;
    password: string | null;
    domain: string | null;
    _credentials_required: boolean;
    width: number;
    height: number;
    security: AUTHENTICATION_MODES;
    ignore_cert: boolean;
    console: boolean;
    initial_program: string | null;
    server_layout: KEYBOARD_LAYOUTS | null;
    color_depth: COLOR_DEPTHS;
    force_lossless: boolean;
    enable_font_smoothing: boolean;
    enable_wallpaper: boolean;
    enable_theming: boolean;
    enable_full_window_drag: boolean;
    enable_desktop_composition: boolean;
    enable_menu_animations: boolean;
    disable_copy: boolean;
    disable_paste: boolean;
    normalize_clipboard: CLIPBOARD_MODES;

    constructor() {
        this.hostname = "";
        this.port = 3389;
        this.width = 1024;
        this.height = 768;
        this.username = "";
        this.password = "";
        this.domain = "";
        this._credentials_required = false;
        this.security = AUTHENTICATION_MODES.ANY;
        this.ignore_cert = true;
        this.console = false;
        this.initial_program = "";
        this.server_layout = KEYBOARD_LAYOUTS.ENGLISH_US;
        this.color_depth = COLOR_DEPTHS.COLORS_16M;
        this.force_lossless = false;
        this.enable_font_smoothing = true;
        this.enable_wallpaper = false;
        this.enable_theming = false;
        this.enable_full_window_drag = false;
        this.enable_desktop_composition = false;
        this.enable_menu_animations = false;
        this.disable_copy = false;
        this.disable_paste = false;
        this.normalize_clipboard = CLIPBOARD_MODES.CONVERT_TO_WINDOWS_CRLF;
    }
}

/**
 * An RDPLogin represents a target windows machine.
 * 
 * Example use:
 * ```javascript
 * await new RDPLogin("test")
 *     .at("10.0.2.2", 1122)
 *     .withCredentials('postgres', 'my_key', 'postgres')
 *     .create(api) ;
 * ```
 * or
 * ```javascript
 * await RDPLogin.build({
 *     name: "test", 
 *     host: "10.0.2.2", 
 *     port: 1122
 *     user: "postgres",
 *     privateKey: "my_key",
 *     password: "postgres"
 * }).create(api)
 * ```
 */
export class RemoteDesktopLogin implements ISerializable {

    /**
     * Searches remote logins
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns id, name, uri and granted
    */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.search_remote_desktops(payload);
    }

    /**
     * gets details for a remote desktop
     * NOTE: Non-admins will only be able to see their granted remote desktops
     * @param api 
     * @param name login name
     * @returns  RemoteDesktopLogin
    */
    public static getByName(api: MamoriService, name: string): Promise<RemoteDesktopLogin> {
        return api.get_remote_desktop_details(name).then(result => {
            result.protocol = result._protocol;
            result.record = result._record_session;
            result.id = result._id;
            delete result._id;
            delete result._protocol;
            delete result._record_session;
            let r = new RemoteDesktopLogin(name, result.protocol);
            return r.fromJSON(result);
        });
    }

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): RemoteDesktopLogin {
        let x = ds.protocol ? ds.protocol : REMOTE_DESKTOP_PROTOCOL.RDP;
        let result = new RemoteDesktopLogin(ds.name, ds.protocol);
        result.fromJSON(ds);
        return result;
    }

    name: string;
    private _id: number | null;
    private _protocol?: REMOTE_DESKTOP_PROTOCOL;
    private _record_session?: boolean;
    vnc?: VNC | null;
    rdp?: RDP | null;
    /**
     * @param name  Unique RemoteServerLogin name
     */
    public constructor(name: string, protocol: REMOTE_DESKTOP_PROTOCOL) {
        this._id = null;
        this.name = name;
        this.protocol = protocol;
        this._record_session = true;
    }

    set loginMode(mode: LOGIN_PROMPT_MODE) {
        let rec = this.rdp ? this.rdp! : this.vnc!;
        if (mode == LOGIN_PROMPT_MODE.MANUAL) {
            rec._credentials_required = true;
            rec.username = "";
            rec.password = "";
        } else if (mode == LOGIN_PROMPT_MODE.OS_PROMPT) {
            rec._credentials_required = false;
            rec.username = "";
            rec.password = "";
        } else if (mode == LOGIN_PROMPT_MODE.MAMORI_PROMPT) {
            rec._credentials_required = true;
            rec.username = "";
            rec.password = "";
        }
    }

    get loginMode(): LOGIN_PROMPT_MODE {
        let rec = this.rdp ? this.rdp! : this.vnc!;
        if (rec._credentials_required) {
            return (rec.username != "") ? LOGIN_PROMPT_MODE.MANUAL : LOGIN_PROMPT_MODE.MAMORI_PROMPT;
        }
        return LOGIN_PROMPT_MODE.OS_PROMPT;
    }

    set id(value: number) {
        this._id = value;
    }

    get id(): number {
        return this._id ? this._id : -1;
    }

    set protocol(value: REMOTE_DESKTOP_PROTOCOL) {
        if (value == REMOTE_DESKTOP_PROTOCOL.RDP) {
            this._protocol = REMOTE_DESKTOP_PROTOCOL.RDP;
            this.vnc = null;
            if (!this.rdp) {
                this.rdp = new RDP();
            }
        } else if (value == REMOTE_DESKTOP_PROTOCOL.VNC) {
            this._protocol = REMOTE_DESKTOP_PROTOCOL.VNC;
            this.rdp = null;
            if (!this.vnc) {
                this.vnc = new VNC()
            }
        }
    }

    get protocol(): REMOTE_DESKTOP_PROTOCOL {
        return this._protocol ? this._protocol : REMOTE_DESKTOP_PROTOCOL.RDP;
    }

    set record(value: boolean) {
        this._record_session = value;
    }

    get record(): boolean {
        return this._record_session!;
    }

    public defaultSettings() {
        if (this._protocol == REMOTE_DESKTOP_PROTOCOL.RDP) {
            this.rdp = new RDP();
            this.vnc = null;
        } else {
            this.vnc = new VNC()
            this.rdp = null;
        }
    }

    /**
         * Initialize the object from JSON.
         * Call toJSON to see the expected record.
         * @param record JSON record
         * @returns
         */
    fromJSON(record: any) {
        for (let prop in this) {
            if ((prop != REMOTE_DESKTOP_PROTOCOL.RDP) && (prop != REMOTE_DESKTOP_PROTOCOL.VNC)) {
                if (prop == "_protocol") {
                    this.protocol = record.protocol;
                } else if (prop == "_record_session") {
                    this.record = record.record;
                } else if (prop == "_id") {
                    this.id = record.id;
                }
                else if (record.hasOwnProperty(prop)) {
                    this[prop] = record[prop];
                }
            }
        }
        if (this.rdp && record.rdp) {
            this.rdp = JSON.parse(JSON.stringify(record.rdp));
        } else if (this.rdp) {
            for (let prop in this.rdp) {
                if (record.hasOwnProperty(prop)) {
                    (this.rdp as any)[prop] = record[prop];
                }
            }
        }
        if (this.vnc && record.vnc) {
            this.vnc = JSON.parse(JSON.stringify(record.vnc));
        } else
            if (this.vnc) {
                for (let prop in this.vnc) {
                    if (record.hasOwnProperty(prop)) {
                        (this.vnc as any)[prop] = record[prop];
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
            if ((prop != REMOTE_DESKTOP_PROTOCOL.RDP) && (prop != REMOTE_DESKTOP_PROTOCOL.VNC)) {
                if (prop == "_protocol") {
                    res.protocol = this.protocol;
                } else if (prop == "_record_session") {
                    res.record = this.record;
                } else if (prop == "_id") {
                    res.id = this.id;
                }
                else {
                    res[prop] = this[prop];
                }
            }
        }
        if (this.rdp) {
            for (let prop in this.rdp) {
                res[prop] = (this.rdp as any)[prop];
            }
        }
        if (this.vnc) {
            for (let prop in this.vnc) {
                res[prop] = (this.vnc as any)[prop];
            }
        }
        return res;
    }


    /**
     * Create a new rdp login with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        let payload = objectClone({}, this.rdp);
        payload._protocol = this._protocol;
        payload._record_session = this._record_session;
        return api.create_remote_desktop(this.name, payload);
    }

    /**
     * Update an existing rd with the current properties.
     * id must be set
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public update(api: MamoriService): Promise<any> {
        let payload = objectClone({}, this.rdp);
        payload._protocol = this._protocol;
        payload._record_session = this._record_session;
        return api.update_remote_desktop(this.id, this.name, payload);
    }

    /**
     * Delete this SshLogin.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        return api.delete_remote_desktop(this.name);
    }

    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return new RemoteDesktopLoginPermission().name(this.name).grantee(grantee).grant(api);
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return new RemoteDesktopLoginPermission().name(this.name).grantee(grantee).revoke(api);
    }

    /**
     * Set the address of the target resource
     * @param host  Required host name or IP address of the target resource
     * @param port  Required listening port of the target resource
     * @returns 
     */
    public at(host: string, port: any): RemoteDesktopLogin {
        if (this._protocol == REMOTE_DESKTOP_PROTOCOL.RDP) {
            this.rdp!.hostname = host;
            this.rdp!.port = port;
        } else {
            this.vnc!.hostname = host;
            this.vnc!.port = port;
        }
        return this;
    }

    public withLoginMode(mode: LOGIN_PROMPT_MODE): RemoteDesktopLogin {
        this.loginMode = mode;
        return this;
    }

    /**
     * Set the creadentials to use when connecting to the target resource
     * @param user        Required user name
     * @param password  Required private key name
     * @param domain    Optional password
     * @returns 
     */
    public withCredentials(user: string, password: string, domain?: string): RemoteDesktopLogin {
        if (this._protocol == REMOTE_DESKTOP_PROTOCOL.RDP) {
            this.rdp!.username = user;
            this.rdp!.password = password;
            this.rdp!.domain = domain ? domain : "";
        } else {
            this.rdp!.username = user;
            this.rdp!.password = password;
        }
        return this;
    }

}

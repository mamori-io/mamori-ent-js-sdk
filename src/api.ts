/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import axios from 'axios';
import { AxiosInstance, Method } from 'axios';
import { Datasource } from "./datasource";
import { Key, KEY_TYPE, SSH_ALGORITHM } from "./key";
import { Network, IpSecVpn, OpenVPN, SshTunnel } from "./network";
import { SshLogin } from "./ssh-login";
import { RoleGrant, Role } from "./role";
import { Runnable } from './runnable';
import { decodeMessage } from './utils';

import { MamoriWebsocketClient } from './ws_client';

// namespaces
import * as io_https from 'https';
import * as io_alertchannel from './alert-channel';
import * as io_datasource from "./datasource";
import * as io_ipresource from './ip-resource';
import * as io_key from './key';
import * as io_network from './network';
import * as io_permission from './permission';
import * as io_ondemandpolicies from './on-demand-policy';
import * as io_remotedesktop from './remote-desktop-login';
import * as io_role from './role';
import * as io_serversession from './server-session';
import * as io_serversettings from './server-settings';
import * as io_sqlmaskingpolicies from './sql-masking-policy';
import * as io_ssh from './ssh-login';
import * as io_user from './user';
import * as io_utils from './utils';
import * as io_wireguardpeers from './wireguard-peer';
import * as io_policy from './policy';
import * as io_secret from './secret';
import * as io_http_resource from './http-resource';
import * as io_requestable_resource from './requestable_resource';
import * as io_db_credential from "./db-credential";
import * as io_providers from "./provider";
import * as eventable from './eventable';
import * as io_utility_helper from "./__utility__/test-helper";
import * as io_utility_ds from "./__utility__/ds";

export {
    Datasource
    , Key, KEY_TYPE, SSH_ALGORITHM
    , Network
    , SshLogin
    , Role, RoleGrant
    , IpSecVpn
    , OpenVPN
    , SshTunnel
    , Runnable
    , eventable
    , MamoriWebsocketClient
    , io_https
    , io_alertchannel
    , io_datasource
    , io_ipresource
    , io_key
    , io_network
    , io_permission
    , io_ondemandpolicies
    , io_remotedesktop
    , io_role
    , io_serversession
    , io_serversettings
    , io_sqlmaskingpolicies
    , io_ssh
    , io_user
    , io_utils
    , io_wireguardpeers
    , io_policy
    , io_secret
    , io_http_resource
    , io_requestable_resource
    , io_db_credential
    , io_utility_helper
    , io_utility_ds
    , io_providers
};


type ApiCacheEntry = { deferred: Promise<any>, resolved: boolean, value?: any }

interface StringIndexed<T> {
    [key: string]: T;
}

// Storage for the opt in DM API request cache
let ___api_request_cache___: StringIndexed<ApiCacheEntry> = {};

type PromiseCallback = (value: any) => void;
type ApiCallback = (result: any, resolve: PromiseCallback, reject: PromiseCallback) => void;

export type ProgressHandler = (value: any, cont: (flag: boolean) => void) => void;
interface PromiseHolder {
    resolve: (result?: any) => void;
    reject: (error: any) => void;
    notify?: ProgressHandler;
}

export class PromiseWithProgress<T> extends Promise<T> {
    _progress?: ProgressHandler;

    public progress(handler: ProgressHandler) {
        this._progress = handler;

        return this;
    }
}

export type Nullable<T> = T | null;

export interface ServiceStatus {
    webd: boolean;
    fqod: boolean;
    derbyd: boolean;
    rdbmsd: boolean;
}

export interface LoginResponse {
    username: string;
    session_id: string;
    roles: string[];
    provider_type: string;
    provider: string;
    privs: string[];
    options: any;
    name: string;
    license_info: any;
    id: number;
    fullname: string;
    externally_authenticated: boolean;
    development_mode: boolean;
}

export interface SshLoginDesc {
    name: string;
    uri: string;
    private_key_name: string;
}

export interface WireguardPeerI {
    id?: string | null;
    userid?: string;
    device_name: string;
    public_key?: string | null;
    allocated_ip_address: string | null;
}

export interface AddWireguardPeerResponse {
    peer: WireguardPeerI;
    private_key?: string;
}

export interface DriverRec {
    name: string;
    type: string;
    classname: string;
    include_parent_classpath: boolean;
    resource_files: any[]
}

export interface QueryOptions {
    cxnname?: string;
    delimiter?: string;
    fetchsize?: number;
}

export type QueryRow = string[];

export interface QueryResponse {
    rows: QueryRow[];
    num_rows: number;
    command: string;
    columns: QueryRow;
}


function buildParams(prefix: string, obj: any, add: (k: string, v: any) => void) {
    var name;

    if (Array.isArray(obj)) {

        // Serialize array item.
        let L = obj.length;
        for (let i = 0; i < L; i++) {
            let v = obj[i]
            // Item is non-scalar (array or object), encode its numeric index.
            buildParams(
                prefix + "[" + (typeof v === "object" && v != null ? i : "") + "]",
                v,
                add
            );
        }

    } else if (typeof obj === "object") {
        // Serialize object item.
        for (name in obj as object) {
            buildParams(prefix + "[" + name + "]", obj[name], add);
        }

    } else {
        // Serialize scalar item.
        add(prefix, obj);
    }
}

export class MamoriService extends eventable.Eventable {

    private _base: string;
    private _http: AxiosInstance;
    private _csrf = "";
    private _cookies: string[] = [];
    private _claims: any;
    private _session_id: Nullable<string> = null;

    private _lastAccess: Nullable<number> = null;
    private _authorization: Nullable<string> = null;

    username?: string;

    constructor(base: string, httpsAgent?: io_https.Agent, websocketOptions?: any) {
        super();
        this._base = base;
        this._http = axios.create({
            baseURL: base,
            httpsAgent: httpsAgent
        });
    }

    get authorization(): Nullable<string> {
        return this._authorization;
    }

    set authorization(newValue: Nullable<string>) {
        this._claims = null;
        this._session_id = null;
        this._lastAccess = null;

        this._authorization = newValue;
        this.trigger("authorization", this);
    }

    get claims(): any {
        let auth = this.authorization;
        if (auth) {
            if (!this._claims) {
                if (typeof (auth) == "string") {
                    this._claims = JSON.parse(auth);
                } else {
                    this._claims = auth;
                }
            }
            return this._claims;
        }

        return null;
    }

    get session_id(): Nullable<string> {
        let c = this.claims;
        if (c) {
            this._session_id = c.session_id;
        }

        return this._session_id;
    }

    get restricted(): boolean {
        let c = this.claims;
        if (c) {
            return c.restricted || false;
        }

        return false;
    }

    get lastAccess(): Nullable<number> {
        return this._lastAccess;
    }

    authorized(): boolean {
        let c = this.claims;
        if (c) {
            return true;
        }

        return false;
    }

    ws(): MamoriWebsocketClient {
        return new MamoriWebsocketClient();
    }

    wsLogin(): Promise<MamoriWebsocketClient> {
        return new Promise<MamoriWebsocketClient>((resolve, reject) => {
            if (this.authorization) {
                this.select("call GENERATE_LOGIN_TOKEN()").then(resp => {
                    let token = resp.rows[0][0];

                    this.ws().connect(this._base.replace(/^http/, "ws") + "/websockets/query", this.claims.username, token).then(sock => {
                        resolve(sock);
                    }).catch(reject);
                }).catch(reject);
            } else {
                reject("not connected");
            }
        });
    }

    logout(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.claims) {
                this._http.request({ method: 'DELETE', url: '/sessions/logout' })
                    .then(() => {
                        this.username = undefined;
                        this.authorization = null;
                        resolve();
                    }).catch(reject);
            }
            else {
                this.username = undefined;
                this.authorization = null;
                resolve();
            }
        });
    }

    has_priv(name: string): boolean {
        return this.claims.privs.find((v: string) => (v == name) || (v == "ALL PRIVILEGES"));
    }


    private calculate_cache_key(url: string, params: any = null): string {
        return url + "::" + JSON.stringify(params);
    }

    public deleteFromCache(url: string) {
        let key = this.calculate_cache_key(url);
        delete ___api_request_cache___[key];
    }

    /**
     * Given a JS object return a query parameter string in the same format that jQuery produces
     */
    public static serialize(obj: object): string {
        let parts: string[] = [];

        for (let k in obj) {
            buildParams(k, (obj as any)[k], (key, value) => {
                parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            })
        }

        return parts.join('&');
    }

    public async callAPI(method: Method, url: string, params: any = null, callback: Nullable<ApiCallback> = null, cachable: boolean = false): Promise<any> {
        var deferred: Promise<any>;
        var cacheKey: string = cachable ? this.calculate_cache_key(url, params) : "";

        if (cachable) {
            var cached = ___api_request_cache___[cacheKey];
            if (cached) {
                if (cached.resolved) {
                    // we have already received a response to this request so return a new resolved "Deferred" with the cached value
                    return Promise.resolve(cached.value);
                }
                // there is a request for this in the cache, but it hasn't resolved yet, or it has failed
                return cached.deferred;

            }
        }

        let that = this;
        deferred = new Promise(function(resolve: any, reject: any) {
            if (!callback) {
                // default callback
                callback = function(result, xresolve, _reject) {
                    xresolve(result);
                };
            }

            let payload: any = {
                method: method,
                url: "/api" + url,
                headers: {
                    "Cookie": that._cookies,
                    "X-CSRF-Token": that._csrf
                }
            }

            if (method == 'GET' || method == 'DELETE') {
                payload.params = params;
                payload.paramsSerializer = MamoriService.serialize;
            } else {
                payload.data = params;
            }

            that._http.request(payload).then(function(x: any) {
                if (callback) {
                    callback(x.data, resolve, reject);
                } else {
                    resolve(x.data);
                }
            }).catch(function(error: any) {
                reject(error);
            });


        });

        if (cachable) {
            ___api_request_cache___[cacheKey] = { deferred: deferred, resolved: false, value: null };
            deferred.then(function(result: any) {
                ___api_request_cache___[cacheKey].resolved = true;
                ___api_request_cache___[cacheKey].value = result;
            });
        }

        return deferred;
    }

    public login(username: string, password: string, otp_password?: string): Promise<LoginResponse> {
        //this.disconnectSocket();
        // fetch the root document to get a session cookie and the CSRF token for the session
        return this._http.request({
            method: "GET",
            url: "/"
        })
            .then(root => {
                let body = root.data;
                this._csrf = body.split(/[<>]/)
                    .filter((s: string) => s.match(/csrf-token/))
                    .map((s: string) => s.replace(/^.*content="/, "").replace(/".*$/, ""))[0];


                this._cookies = (root.headers['set-cookie'] || []).map((s: string) => {
                    let parts = s.split(";");
                    return parts[0];
                });

                return this._http.request({
                    method: 'POST',
                    url: '/sessions/login',
                    data: {
                        username: username.toLowerCase(),
                        password: password,
                        otp_password: otp_password,
                    },
                    headers: {
                        "Cookie": this._cookies,
                        "X-CSRF-Token": this._csrf
                    }
                })
                    .then(resp => {
                        this.authorization = resp.data;
                        this.username = username;
                        return resp.data as LoginResponse;
                    });
            });
    }

    public ping(): Promise<boolean> {
        return this.callAPI("GET", "/v1/ping").then(resp => {
            return resp.pong;
        });
    }

    public change_password(old_password: string, new_password: string) {
        return this.callAPI("POST", "/v1/change_password", { old_password: old_password, new_password: new_password })
    }

    public service_status(): Promise<ServiceStatus> {
        return this._http.request({
            method: 'GET',
            url: '/status'
        }).then(resp => resp.data);
    }

    public call_operation(operation: string, filter?: any): Promise<QueryResponse> {
        return this.callAPI("POST", "/v1/query", {
            operation: operation,
            filter: filter,
        });
    }

    public select(sql: string, search_query?: any): Promise<QueryResponse> {
        return this.callAPI("POST", "/v1/query", {
            sql: sql,
            search_query: search_query,
        });
    }

    public create_db_policy(name: string, priority: any, description: string): Promise<any> {
        let options: any = { name: name, description: description };
        if (priority && !isNaN(Number(priority))) {
            options.priority = priority;
        }
        return this.callAPI("POST", "/v1/policies/dbpolicy", options);
    }

    public read_db_policy(name: string): Promise<any> {
        return this.callAPI("GET", "/v1/policies/dbpolicy/" + name);
    }

    public delete_db_policy(name: string): Promise<any> {
        return this.callAPI("DELETE", "/v1/policies/dbpolicy/" + name);
    }

    public update_db_policy(id: any, rec: any): Promise<any> {
        return this.callAPI("PUT", "/v1/policies/dbpolicy/" + id, rec);
    }


    public get_smtp_cfg() {
        return this.callAPI("GET", "/v1/smtp").then((data: any) => {
            return this.system_properties().then((props) => {
                data.logo = props.email_logo;
                data.logo_height = props.email_logo_height;
                return data;
            });
        });
    }

    public set_smtp_cfg(options: any) {
        return this.callAPI("PUT", "/v1/smtp", options).then(r => {
            return this.set_system_properties({
                email_logo: options.logo,
                email_logo_height: options.logo_height,
            });
        });
    }

    public send_test_email(options: any) {
        return this.callAPI("POST", "/v1/smtp/test", options);
    }

    //
    // Administration
    //

    public system_properties() {
        return this.callAPI("GET", "/v1/server_properties");
    }

    public get_system_properties(query: string) {
        return this.callAPI("GET", "/v1/server_properties" + query);
    }

    public set_system_properties(jsonProperties: any) {
        return this.callAPI("PUT", "/v1/server_properties", { properties: jsonProperties });
    }

    public set_system_property(name: string, value: any) {
        return this.callAPI("PUT", "/v1/server_properties/" + name, { value: value });
    }

    //
    // Activity monitoring
    //

    public connection_info(ssid: string) {
        return this.callAPI("GET", "/v1/connection_log/" + ssid);
    }

    public ssh_session_log(ssid: string, options: any = null) {
        return this.callAPI("GET", "/v1/ssh/" + ssid, options);
    }

    //
    // Drivers
    //

    // public driver_types() {
    //     // NOTE: this is cached as the back end is returning a hard coded list of values for this request
    //     return this.callAPI("GET", "/v1/driver_types", null, null, true);
    // }

    public drivers_resources(drivername: string) {
        return this.callAPI("GET", "/v1/drivers/" + drivername + "/files");
    }

    // public drivers() {
    //     return this.callAPI("GET", "/v1/drivers");
    // }

    public drivers_for_type(driver_type: string) {
        return this.callAPI("GET", "/v1/drivers?type=" + driver_type);
    }

    public create_driver_for_rec(opt: DriverRec) {
        return this.create_driver(opt.name,
            opt.type,
            opt.classname,
            opt.include_parent_classpath,
            opt.resource_files);
    }

    public create_driver(driver_name: string, driver_type: string, classname: string, include_parent_classpath: boolean, resource_files: any[]) {
        let rec = {
            name: driver_name,
            type: driver_type,
            classname: classname,
            include_parent_classpath: include_parent_classpath,
            resource_files: resource_files
        };
        return this.callAPI("POST", "/v1/drivers", rec);
    }

    public update_driver(drivername: string, options: any) {
        return this.callAPI("PUT", "/v1/drivers/" + drivername, options);
    }

    public delete_driver(drivername: string) {
        return this.callAPI("DELETE", "/v1/drivers/" + drivername);
    }

    //
    //  Access rules
    //

    public drop_access_rule(id: number) {
        return this.callAPI("DELETE", "/v1/access_rules/" + id);
    }

    public update_access_rule_position(id: number, position: number) {
        let rec = { position: position };
        return this.callAPI("PUT", "/v1/access_rules/" + id, rec);
    }

    public update_access_rule(id: number, type: string, clause: string, position: number, alert: string, description: string, enabled: boolean) {
        let rec = {
            id: id,
            type: type,
            clause: clause,
            description: description,
            position: position,
            alert: alert,
            enabled: enabled
        };

        return this.callAPI("PUT", "/v1/access_rules/" + id, rec);
    }

    public create_access_rule(type: string, clause: string, position: number, alert: string, description: string, enabled: boolean) {
        let rec = {
            type: type,
            clause: clause,
            description: description,
            position: position,
            alert: alert,
            enabled: enabled
        };

        return this.callAPI("POST", "/v1/access_rules", rec);
    }


    public get_current_access_rules(filter: any) {
        filter = filter || {};
        filter.current = "Y";
        return this.callAPI("GET", "/v1/access_rules", filter);
    }

    //
    // Masking
    //

    public save_masking_procedure(rmsid: number, name: string, expression: string, description: string, data_type: string) {
        let rec = {
            rmsid: rmsid,
            name: name,
            expression: expression,
            description: description,
            data_type: data_type,
        };

        return this.callAPI("POST", "/v1/maskingprocedures", rec);
    }

    public get_masking_procedures(options: any) {
        return this.callAPI("GET", "/v1/maskingprocedures", options);
    }

    public delete_masking_procedure(rmsid: number, name: string) {
        return this.callAPI("DELETE", "/v1/maskingprocedures/1", { name: name, rmsid: rmsid });
    }

    public get_restricted_columns() {
        return this.callAPI("GET", "/v1/restricted_columns");
    }

    public add_restricted_column(rms: string, column: string) {
        return this.callAPI("POST", "/v1/restricted_columns", { rms_name: rms, column_name: column });
    }

    public drop_restricted_column(rms: string, column: string) {
        return this.callAPI("DELETE", "/v1/restricted_columns/1", { rms_name: rms, column_name: column });
    }

    //
    // Roles
    //

    public get_grantee_roles(roleid: string) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/grantee");
    }

    public get_grantee_roles_recursive(roleid: string) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/grantee?recursive=Y");
    }

    public get_granted_roles(roleid: string) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/granted");
    }

    public get_granted_roles_recursive(roleid: string) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/granted?recursive=Y");
    }

    public get_grantee_grantable_roles(roleid: string) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/grantee/grantable");
    }

    public get_roles_with_grantable(roleid: string) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/roles");
    }

    // public get_roles_by_username(roleid: string) {
    //     return this.callAPI("GET", "/v1/username/" + roleid + "/roles");
    // }

    // public roles(query: string = "") {
    //     return this.callAPI("GET", "/v1/roles?distinct=Y"+query);
    // }

    // public roles_search(query: any) {
    //     return this.callAPI("PUT", "/v1/search/roles", query);
    // }

    // public roles_complete() {
    //     return this.callAPI("GET", "/v1/roles");
    // }

    // public role(rolename: string) {
    //     return this.callAPI("GET", "/v1/roles/" + rolename);
    // }

    // public update_role(role: string, options: any) {
    //     return this.callAPI("PUT", "/v1/roles/" + role, options);
    // }

    // public create_role(options: any) {
    //     return this.callAPI("POST", "/v1/roles", options);
    // }

    public attach_roles(name: string, roles: string[]) {
        return this.callAPI("POST", "/v1/roles/" + name + "/attach", roles);
    }

    public user_roles(username: string) {
        return this.callAPI("GET", "/v1/roles?isdef=N&grantee=" + encodeURIComponent(username.toLowerCase()));
    }

    public user_roles_recursive(username: string) {
        return this.callAPI("GET", "/v1/roles?recursive=Y&grantee=" + encodeURIComponent(username.toLowerCase()));
    }

    public users_roles_recursive(userlist: string[]) {
        return this.callAPI("GET", "/v1/roles?recursive=Y", { grantee: userlist });
    }

    public grant_roles_to_user(username: string, roles: string[]) {
        return this.callAPI("POST", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/roles", { selected_roles: roles });
    }

    public revoke_roles_from_user(username: string, roles: string[]) {
        return this.callAPI("DELETE", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/roles", { selected_roles: roles });
    }

    public update_user_roles(username: string, deleted: string[], added: string[]) {
        if (deleted.length > 0 && added.length > 0) {
            return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/roles", {
                selected_roles: added,
                deleted_roles: deleted
            });
        }
        else if (deleted.length > 0) {
            return this.revoke_roles_from_user(username, deleted);
        }
        else if (added.length > 0) {
            return this.grant_roles_to_user(username, added);
        }
        else {
            return
        }
    }

    public get_role_user_count(roleid: string) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/usercount");
    }

    public search_users_with_role(roleid: string, options: any) {
        return this.callAPI("PUT", "/v1/search/roles/" + roleid + "/users", options);
    }

    //
    // Credentials
    //

    public get_role_credentials(role: string) {
        return this.callAPI("GET", "/v1/roles/" + role + "/credentials");
    }

    public update_role_credentials(role: string, deleted_creds: string[], new_creds: string[]) {
        if (deleted_creds.length > 0 && new_creds.length > 0) {
            return this.callAPI("PUT", "/v1/roles/" + role + "/credentials", {
                db_credentials: new_creds,
                deleted_credentials: deleted_creds
            });
        }
        else if (deleted_creds.length > 0) {
            return this.drop_role_credentials(role, deleted_creds);

        } else if (new_creds.length) {
            return this.add_role_credentials(role, new_creds);
        }
    }

    public drop_role_credentials(role: string, credentials: string[]) {
        return this.callAPI("DELETE", "/v1/roles/" + role + "/credentials", { db_credentials: credentials });
    }

    public add_role_credentials(role: string, credentials: string[]) {
        return this.callAPI("POST", "/v1/roles/" + role + "/credentials", { db_credentials: credentials });
    }

    // public add_datasource_authorization_to(grantee: string, datasource: string, username: string, password: string) {
    //     return this.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/datasource_authorization",
    //         {datasource: datasource, username: username, password: password});
    // }

    // public drop_datasource_authorization_from(grantee: string, datasource: string) {
    //     return this.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/datasource_authorization", {datasource: datasource});
    // }

    // public validate_datasource_authorization(grantee: string, datasource: string, username: string, password: string) {
    //     return this.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/datasource_authorization/validate",
    //         {datasource: datasource, username: username, password: password});
    // }

    //
    // Permissions
    //

    public grant_to(grantee: string, grantables: string[], object_name?: string | null, withGrantOption?: boolean, options?: any) {
        let payload: any = {
            grantables: grantables,
            object_name: object_name,
            with_grant_option: withGrantOption,
        };
        for (let prop in options) {
            payload[prop] = options[prop];
        }
        return this.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()), payload).then(r => {
            if (r && r.length > 0 && r[0] === "ok") {
                return { errors: false, result: r };
            }
            return { errors: true, result: r };
        });
    }

    public revoke_from(grantee: string, grantables: string[], object_name?: string | null, options?: any) {
        let payload: any = {
            grantables: grantables
        };
        if (object_name) {
            payload.object_name = object_name;
        }

        for (let prop in options) {
            payload[prop] = options[prop];
        }
        return this.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()), payload).then(r => {
            if (r && r.length > 0 && r[0] === "ok") {
                return { errors: false, result: r };
            }
            return { errors: true, result: r };
        });
    }

    public update_global_permission(rolename: string, deleted: string[], added: string[]) {
        if (deleted.length > 0 && added.length > 0) {
            return this.callAPI("PUT", "/v1/roles/" + rolename + "/global/permissions", {
                selected_permission: added,
                deleted_permission: deleted
            });
        }
        else if (deleted.length > 0) {
            return this.revoke_global_permission(rolename, { deleted_permission: deleted });
        }
        else if (added.length > 0) {
            return this.grant_global_permission(rolename, { selected_permissions_cirro: added });
        }
        else {
            return
        }
    }

    public update_object_permission(rolename: string, deleted: string[], added: string[]) {
        if (deleted.length > 0 && added.length > 0) {
            return this.callAPI("PUT", "/v1/roles/" + rolename + "/object/permissions", {
                selected_permissions_object: added,
                deleted_permission: deleted
            });
        }
        else if (deleted.length > 0) {
            return this.revoke_object_permission(rolename, { deleted_permission_object: deleted });
        }
        else if (added.length > 0) {
            return this.grant_object_permission(rolename, { selected_permissions_object: added });
        }
    }

    public grantee_object_grants(grantee: string, permissionType: string, objectName: string) {
        return this.callAPI("GET", "/v1/grantee/" + grantee + "/grants", { permission: permissionType, object_name: objectName });
    }

    public grant_global_permission(role: string, permissions: any) {
        return this.callAPI("POST", "/v1/roles/" + role + "/grant/global/permissions", permissions);
    }

    public revoke_global_permission(role: string, permissions: any) {
        return this.callAPI("DELETE", "/v1/roles/" + role + "/grant/global/permissions", permissions);
    }

    public revoke_object_permission(role: string, permissions: any) {
        return this.callAPI("DELETE", "/v1/roles/" + role + "/grant/object/permissions", permissions);
    }

    public grant_object_permission(role: string, permissions: any) {
        return this.callAPI("POST", "/v1/roles/" + role + "/grant/object/permissions", permissions);
    }

    public permissions_by_role(roleid: string, scopes: string[]) {
        return this.callAPI("GET", "/v1/roles/" + roleid + "/permissions", scopes ? { scope: scopes } : null);
    }

    public privileges(query: string) {
        return this.callAPI("GET", "/v1/privileges" + query);
    }

    public grantee_privileges_recursive(grantees: string[]) {
        return this.callAPI("GET", "/v1/privileges?recursive=Y", { "grantee": grantees });
    }

    public grantees() {
        return this.callAPI("GET", "/v1/grantees");
    }

    public permissions(scopes?: string[]) {
        return this.callAPI("GET", '/v1/permissions', scopes ? { scope: scopes } : null);
    }

    public permissionsFiltered(scopes?: string[], permissionType?: string) {
        let conditions: any = {};
        if (scopes) {
            conditions["scope"] = scopes;
        }
        if (permissionType) {
            conditions["permissiontype"] = permissionType;
        }
        return this.callAPI("GET", '/v1/permissions', conditions);
    }

    // public system() {
    //     return this.callAPI("GET", '/v1/permissions/dbtree');
    // }

    //
    // Authentication providers
    //

    public providers() {
        return this.callAPI("GET", "/v1/providers");
    }

    public get_provider(name:String) {
        return this.callAPI("GET", "/v1/providers/"+encodeURIComponent(name.toLowerCase()));
    }

    public get_provider_options() {
        return this.callAPI("GET", "/v1/providers?options=y");
    }

    public add_provider(options: any) {
        return this.callAPI("POST", "/v1/providers", options);
    }

    public update_provider(name: string, options: any) {
        return this.callAPI("PUT", "/v1/providers/" + name, options);
    }

    public drop_provider(name: string) {
        return this.callAPI("DELETE", "/v1/providers/" + name);
    }

    public validate_provider(provider: string, username: string, password: string) {
        return this.callAPI("POST", "/v1/provider/validate", { provider: provider, username: username, password: password });
    }

    public set_default_provider_chain(options: any) {
        return this.callAPI("POST", "/v1/defaults/provider", options);
    }

    public set_totp_cache_time(time: number) {
        return this.callAPI("PUT", "/v1/defaults/totpcachetime/" + time);
    }

    public set_totp_properties(seconds: number, url: string) {
        return this.callAPI("PUT", "/v1/defaults/totpproperties", { seconds: seconds, url: url });
    }

    public ldap_search(options: any) {
        return this.callAPI("POST", "/v1/ldap/search/", options);
    }

    public enable_provider(name: string, type: string) {
        return this.callAPI("PUT", "/v1/providers/" + name, {
            name: name,
            type: type,
            enabled: "true"
        });
    }

    public disable_provider(name: string, type: string) {
        return this.callAPI("PUT", "/v1/providers/" + name, {
            name: name,
            type: type,
            enabled: "false"
        });
    }

    //
    // Agents
    //

    public agents() {
        return this.callAPI("GET", "/v1/agents");
    }

    public agent_drop(agent_name: string) {
        return this.callAPI("DELETE", "/v1/agents/" + encodeURIComponent(agent_name));
    }

    public agent_create(agent_params: string) {
        return this.callAPI("POST", "/v1/agents", agent_params);
    }

    //
    // Datasources, databases, schemas, tables,...
    //

    public databases_filtered(conditions: string) {
        return this.callAPI("GET", "/v1/objects/databases?" + conditions);
    }

    public databases_privileges(system: string) {
        return this.callAPI("GET", "/v1/objects/databases/privileges", system);
    }

    public databases() {
        return this.callAPI("GET", "/v1/objects/databases");
    }

    public get_catalogs() {
        return this.callAPI("GET", "/v1/catalogs");
    }

    public database_validate_login(system_name: string, options: any) {
        return this.callAPI("PUT", "/v1/objects/databases/" + encodeURIComponent(system_name) + "/validate", options);
    }

    public schemas(system_name: string) {
        let url = "/v1/objects/databases/" + encodeURIComponent(system_name);
        return this.callAPI("GET", url);
    }

    public database_schemas(system_name: string, database_name: string) {
        let url = "/v1/objects/databases/" + encodeURIComponent(system_name) + "?database=" + database_name;
        //console.info(url);
        return this.callAPI("GET", url);
    }

    public get_tables_by_system_schema(system_name: string, schema: string) {
        return this.callAPI("GET", "/v1/objects/system/" + encodeURIComponent(system_name) + "/schemas/" + encodeURIComponent(schema) + "/tables");
    }

    public objects(system_name: string, database_name: string, schema_name: string, name: string) {
        let params: any = { "system_name": system_name, "database_name": database_name, "schema_name": schema_name };
        if (name) {
            params["object_name"] = name;
        }
        return this.callAPI("GET", "/v1/objects", params)
    }

    //
    // System groups
    //

    public system_groups_search(options: any) {
        return this.callAPI("PUT", "/v1/systemgroups", options);
    }

    public create_systemgroup(options: any) {
        return this.callAPI("POST", "/v1/systemgroups", options);
    }

    public delete_systemgroup(name: string) {
        return this.callAPI("DELETE", "/v1/systemgroups/" + name);
    }

    public alter_systemgroup(name: string, options: any) {
        return this.callAPI("PUT", "/v1/systemgroups/" + name, options);
    }

    public system_group_systems_search(group: string, options: any) {
        return this.callAPI("PUT", "/v1/systemgroups/" + group + "/systems", options);
    }

    public system_group_add_system(group: string, system: string) {
        return this.callAPI("POST", "/v1/systemgroups/" + group + "/systems", { system: system });
    }

    public system_group_remove_system(group: string, system: string) {
        return this.callAPI("DELETE", "/v1/systemgroups/" + group + "/systems/" + system);
    }

    public system_group_add_credential(group: string, grantee: string, login: string, pw: string, options: any) {
        return this.callAPI("POST", "/v1/systemgroups/" + group + "/credentials", {
            grantee: grantee,
            login: login,
            pw: pw,
            options: options
        });
    }

    public system_group_remove_credential(group: string, options: any) {
        return this.callAPI("POST", "/v1/systemgroups/" + group + "/credentials/delete", options);
    }

    public system_group_credentials_search(group: string, options: any) {
        return this.callAPI("PUT", "/v1/systemgroups/" + group + "/credentials", options);
    }

    // public license_details() {
    //     return this.callAPI("GET", "/v1/license", null, null, true);
    // }

    // public license_limits() {
    //     return this.callAPI("GET", "/v1//license/limits")
    // }

    // public pending_license_details() {
    //     return this.callAPI("GET", "/v1/license?pending_license_info=1", null, null, true);
    // }

    // public license_stats() {
    //     return this.callAPI("GET", "/v1/license/stats");
    // }

    // public get_qr_code(id: string) {
    //     return this.callAPI("GET", "/ua/qrcheck/" + id);
    // }

    public create_backup() {
        return this.callAPI("GET", "/v1/backup");
    }

    public server_time() {
        return this.callAPI("GET", "/v1/time");
    }

    public server_version() {
        return this.callAPI("GET", "/v1/version");
    }

    public get_timezones() {
        return this.callAPI("GET", "/v1/timezones", null, null, true);
    }

    //
    // Users
    //

    public users(query: string = "") {
        return this.callAPI("GET", "/v1/users" + query);
    }

    // public user_has_pending_validation(username: string) {
    //     return this.callAPI("GET", "/ua/pending/" + encodeURIComponent(username.toLowerCase()));
    // }

    public users_search(query: any) {
        return this.callAPI("PUT", "/v1/search/users", query);
    }

    public users_count() {
        return this.callAPI("GET", "/v1/count/users");
    }

    public users_external() {
        return this.callAPI("GET", "/v1/users?external=y");
    }

    public users_connected() {
        return this.callAPI("GET", "/v1/users?connected=y");
    }

    public users_reload_all() {
        return this.callAPI("GET", "/v1/users?reload_all=y");
    }

    public users_clear_authentication_requests() {
        return this.callAPI("GET", "/v1/users?clear_authentication_requests=y");
    }

    public user(username: string) {
        return this.callAPI("GET", "/v1/users/" + encodeURIComponent(username.toLowerCase()));
    }

    public create_user(options: any) {
        return this.callAPI("POST", "/v1/users", options);
    }

    public delete_user(username: string) {
        return this.callAPI("DELETE", "/v1/users/" + encodeURIComponent(username.toLowerCase()));
    }

    public update_user(username: string, options: any) {
        return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()), options);
    }

    public notify_user(username: string) {
        return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/notify");
    }

    public generate_password(username: string) {
        return this.callAPI("GET", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/generate_password");
    }

    public user_update(username: string, options: any) {
        return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()), options);
    }

    public reset_user_password(username: string) {
        return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/reset_password");
    }

    public reset_external_user(username: string) {
        return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/reset_external");
    }

    public delete_external_user(username: string) {
        return this.callAPI("DELETE", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/external");
    }

    public disable_user(username: string) {
        return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/disable");
    }

    public unlock_user(username: string) {
        return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/unlock");
    }

    public user_options(username: string) {
        return this.callAPI("GET", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/options");
    }

    public get_pending_user_sessions(username: string) {
        return this.callAPI("GET", "/ua/sessions/" + encodeURIComponent(username.toLowerCase()));
    }

    // return all users/roles and which systems they are authorized to access
    public get_role_authorization_by_system(params?: any) {
        return this.callAPI("GET", "/v1/roles/auth/systems", params);
    }

    public revoke_role_from_users(roleid: string, users: string[]) {
        return this.callAPI("DELETE", "/v1/roles/" + roleid + "/users", { selected_users: users });
    }

    public revoke_role_from_grantee(roleid: string, grantee: string) {
        return this.callAPI("DELETE", "/v1/roles/" + roleid + "/user", { selected_user: grantee });
    }

    public grant_role_to_users(roleid: string, users: string[]) {
        return this.callAPI("POST", "/v1/roles/" + roleid + "/users", { selected_users: users });
    }

    public grant_role_to_grantee(roleid: string, grantee: string) {
        return this.callAPI("POST", "/v1/roles/" + roleid + "/user", { selected_user: grantee });
    }

    public get_grantee_policies(grantee: string) {
        return this.callAPI("GET", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/policies");
    }

    public search_grantee_policies(grantee: string, options: any) {
        return this.callAPI("PUT", "/v1//grantee/" + grantee + "/policies", options);
    }

    public update_role_users(roleid: string, deleted: any, added: any) {
        if (deleted.length > 0 && added.length > 0) {
            return this.callAPI("PUT", "/v1/roles/" + roleid + "/users", {
                selected_users: added,
                deleted_users: deleted
            });
        }
        else if (deleted.length > 0) {
            return this.revoke_role_from_users(roleid, deleted);

        } else {
            return this.grant_role_to_users(roleid, added);
        }
    }

    // public delete_role(roleid: string) {
    //     return this.callAPI("DELETE", "/v1/roles/" + roleid);
    // }

    public get_user_db_creds(username: string) {
        return this.callAPI("GET", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/credentials");
    }

    public update_user_db_creds(username: string, deleted_creds: any, new_creds: any) {
        if (deleted_creds.length > 0 && new_creds.length > 0) {
            return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/credentials", {
                db_credentials: new_creds,
                deleted_credentials: deleted_creds
            });
        }
        else if (deleted_creds.length > 0) {
            return this.drop_user_db_creds(username, deleted_creds);

        } else {
            return this.add_user_db_creds(username, new_creds);
        }
    }

    public drop_user_db_creds(username: string, credentials: any) {
        return this.callAPI("DELETE", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/credentials", { db_credentials: credentials });
    }

    public add_user_db_creds(username: string, credentials: any) {
        return this.callAPI("POST", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/credentials", { db_credentials: credentials });
    }

    public search_permission_log(options: any) {
        return this.callAPI("PUT", "/v1/search/permission_log", options);
    }

    public search_permission_log_sysview(options: any) {
        return this.callAPI("PUT", "/v1/search/permission_log_sysview", options);
    }

    public certs() {
        return this.callAPI("GET", "/v1/certs");
    }

    public install_certs(name: string, ca_crt: string, key: string, crt: string) {
        return this.callAPI("POST", "/v1/certs", { name: name, certs: { key: key, crt: crt, ca_crt: ca_crt } });
    }

    public get_log_entries(logname: string) {
        return this.callAPI("GET", "/v1/logs/system/" + logname);
    }

    public get_logs_zipfile() {
        return this.callAPI("GET", "/v1/logs/download");
    }

    public alerts() {
        return this.callAPI("GET", "/v1/alerts");
    }

    public get_alert(id: number) {
        return this.callAPI("GET", "/v1/alerts/" + id);
    }

    public create_alert(alert: any) {
        return this.callAPI("POST", "/v1/alerts", { alert: alert });
    }

    public update_alert(id: number, alert: any) {
        return this.callAPI("PUT", "/v1/alerts/" + id, { alert: alert });
    }

    public delete_alert(id: number) {
        return this.callAPI("DELETE", "/v1/alerts/" + id);
    }

    public listeners() {
        return this.callAPI("GET", "/v1/listeners");
    }

    public get_detailed_logging_for_listener(listener: string) {
        return this.callAPI("GET", "/v1/listeners/" + listener + "/logging");
    }

    public update_listener(id: string, port: number) {
        return this.callAPI("PUT", "/v1/listeners/" + id, { port: port });
    }

    public update_listener_logging(id: string, flag: boolean) {
        return this.callAPI("PUT", "/v1/listeners/" + id + "/logging", { detailed_logging: flag });
    }

    //
    // Policies
    //

    public delete_policy(policy: string) {
        return this.callAPI("DELETE", "/v1/policies/" + encodeURIComponent(policy.toLowerCase()));
    }

    public policies_get_procedures(query: any) {
        return this.callAPI("PUT", "/v1/policies/get_procedures", query);
    }

    public policies_get_requests(query: any) {
        return this.callAPI("PUT", "/v1/policies/get_requests", query);
    }

    public policies_get_requests_to_endorse(query: any) {
        return this.callAPI("PUT", "/v1/policies/endorse", query);
    }

    public policies_get_procedure_sql(procedure_name: string) {
        return this.callAPI("GET", "/v1/policies/get_procedure_sql/" + procedure_name);
    }

    public policies_get_procedure_parameters(procedure_name: string) {
        return this.callAPI("GET", "/v1/policies/get_procedure_parameters/" + procedure_name);
    }

    public policies_get_procedure_options(procedure_name: string) {
        return this.callAPI("GET", "/v1/policies/get_procedure_options/" + procedure_name);
    }

    public policies_get_request_parameters(request_key: string) {
        return this.callAPI("GET", "/v1/policies/get_request_parameters/" + request_key);
    }

    public policies_request_execute(procedure_name: string, parameters: any, message: string) {
        return this.callAPI("POST", "/v1/policies/request_execute", { procedure_name: procedure_name, parameters: parameters, message: message });
    }

    public policies_request_action(action: string, request_key: string, message: string) {
        return this.callAPI("POST", "/v1/policies/request_action", { action: action, request_key: request_key, message: message });
    }

    public policies_drop_procedure(procedure_name: string) {
        return this.callAPI("GET", "/v1/policies/drop_procedure/" + procedure_name);
    }

    public policies_create_procedure(procedure_name: string,
        parameters: any,
        requires: string,
        type: string,
        description: string,
        request_role: string,
        request_alert: string,
        request_default_message: string,
        endorse_alert: string,
        endorse_default_message: string,
        endorse_agent_count: any,
        deny_alert: string,
        execute_on_endorse: string,
        execute_alert: string,
        approval_expiry: string,
        allow_self_endorse: string,
        request_expiry: string,
        sql: string) {
        return this.callAPI("POST", "/v1/policies/create_procedure", {
            procedure_name: procedure_name,
            parameters: parameters,
            requires: requires ? requires : "",
            type: type ? type : "policy",
            description: description ? description : procedure_name,
            request_role: request_role ? request_role : "",
            request_alert: request_alert ? request_alert : "",
            request_default_message: request_default_message ? request_default_message : "",
            endorse_alert: endorse_alert ? endorse_alert : "",
            endorse_default_message: endorse_default_message ? endorse_default_message : "",
            endorse_agent_count: endorse_agent_count,
            deny_alert: deny_alert ? deny_alert : "",
            execute_on_endorse: execute_on_endorse ? execute_on_endorse : "false",
            execute_alert: execute_alert ? execute_alert : "",
            approval_expiry: approval_expiry,
            allow_self_endorse: allow_self_endorse ? allow_self_endorse : "false",
            request_expiry: request_expiry,
            sql: sql,
        });
    }



    public db_masking_policies(query: any) {
        return this.callAPI("PUT", "/v1/policies/dbpolicy/search", query);
    }

    public policies_get_policy_column_rules(query: any) {
        return this.callAPI("PUT", "/v1/policies/get_policy_column_rules", query);
    }

    public policies_set_policy_projection(table_name: string, column_name: string, projection_expression: string
        , policy_name: string, table_type: any) {
        return this.callAPI("PUT", "/v1/policies/set_policy_projection", {
            table_name: table_name,
            column_name: column_name,
            projection_expression: projection_expression ? projection_expression : "masked",
            policy_name: policy_name ? policy_name : "default",
            table_type: table_type ? table_type : "table",
        });
    }

    public search_users_with_policy(policy: string, options: any) {
        return this.callAPI("PUT", "/v1/policies/" + policy + "/users", options);
    }

    public search_roles_with_policy(policy: string, options: any) {
        return this.callAPI("PUT", "/v1/policies/" + policy + "/roles", options);
    }

    // HTTP PROXY
    public get_http_apifilters(query: any) {
        return this.callAPI("GET", "/v1/policies/http_apifilters", query);
    }

    public get_http_apireveals(query: any) {
        return this.callAPI("GET", "/v1/policies/http_apireveals", query);
    }


    public add_http_apifilter(filter: any) {
        return this.callAPI("POST", "/v1/policies/create_http_apifilter", { filter: filter });
    }

    public set_http_apifilter(filter: any) {
        return this.callAPI("PUT", "/v1/policies/set_http_apifilter/" + filter.id, { filter: filter });
    }

    public delete_http_apifilter(filter_id: Number) {
        return this.callAPI("DELETE", "/v1/policies/delete_http_apifilter/" + filter_id);
    }

    public activate_http_apifilter(filter_id: Number) {
        return this.callAPI("PUT", "/v1/policies/activate_http_apifilter/" + filter_id);
    }

    public disable_http_apifilter(filter_id: Number) {
        return this.callAPI("PUT", "/v1/policies/disable_http_apifilter/" + filter_id);
    }

    //
    // Wireguard
    //

    public search_wireguard_peers(options: any) {
        return this.callAPI("GET", "/v1/wireguard", options);
    }

    public create_wireguard_peer(peer: WireguardPeerI): Promise<AddWireguardPeerResponse> {
        return this.callAPI("POST", "/v1/wireguard", { peer: peer });
    }

    public update_wireguard_peer(peer: any) {
        return this.callAPI("PUT", "/v1/wireguard/" + peer.id, { peer: peer });
    }

    public send_wireguard_notification(username: string, device_name: string, config: string) {
        return this.callAPI("POST", "/v1/wireguard/notify", { username: username, device_name: device_name, config: config });
    }

    public lock_wireguard_peer(id: string) {
        return this.callAPI("PUT", "/v1/wireguard/" + id + "/lock");
    }

    public unlock_wireguard_peer(id: string) {
        return this.callAPI("PUT", "/v1/wireguard/" + id + "/unlock");
    }

    public delete_wireguard_peer(id: string) {
        return this.callAPI("DELETE", "/v1/wireguard/" + id);
    }

    public wireguard_disconnect_user(username: string) {
        return this.callAPI("DELETE", "/v1/wireguard/disconnect_user/" + username);
    }

    public wireguard_disconnect_peer(peer_public_key: string) {
        return this.callAPI("DELETE", "/v1/wireguard/" + encodeURIComponent(peer_public_key) + "/disconnect");
    }

    public get_wireguard_log() {
        return this.callAPI("GET", "/v1/wireguard/log");
    }

    public get_wireguard_status() {
        return this.callAPI("GET", "/v1/wireguard/status");
    }

    public get_wireguard_peers() {
        return this.callAPI("GET", "/v1/wireguard/all");
    }

    public reload_wireguard_config() {
        return this.callAPI("POST", "/v1/wireguard/reload");
    }

    //Remote Desktop Methods
    public search_remote_desktops(options: any): Promise<any> {
        return this.callAPI("GET", "/v1/rdp", options);
    }

    public get_remote_desktop_details(name: string): Promise<any> {
        return this.callAPI("GET", "/v1/rdp/" + name);
    }

    public create_remote_desktop(name: string, details: any): Promise<any> {
        return this.callAPI("POST", "/v1/rdp/", { name: name, details: details });
    }

    public update_remote_desktop(id: number, name: string, details: any): Promise<any> {
        return this.callAPI("PUT", "/v1/rdp/" + id, { name: name, details: details });
    }

    public get_remote_desktop_token(name: string): Promise<any> {
        return this.callAPI("GET", "/v1/rdp/" + name + "/token");
    }

    public get_remote_desktop_download_token(recording_id: number, token_type: string): Promise<any> {
        return this.callAPI("GET", "/v1/rdp/" + recording_id + "/download/" + token_type);
    }

    public delete_remote_desktop(name: string) {
        return this.callAPI("DELETE", "/v1/rdp/" + name);
    }

    public get_remote_desktop_download_link(token: string, onprogress?: (message: string, percentage?: number) => void): Promise<any> {
        return new Promise((resolve, reject) => {
            let ws = new WebSocket(this._base.replace(/^http/, "ws") + "/rdp/tunnel?" + token);
            ws.onmessage = (e: any) => {
                let msg = decodeMessage(e.data);
                if (msg.command == "_status") {
                    if (onprogress) {
                        if (msg.params.length === 1) {
                            onprogress(msg.params[0])
                        } else {
                            onprogress(msg.params[0], Number(msg.params[1]));
                        }
                    }
                } else if (msg.command == "_download") {
                    resolve(this._base + "/rdp/stream/" + msg.params[0]);
                } else if (msg.command == "error") {
                    reject(msg.params[0]);
                }
            };
        });
    }

    public setServerDomain(domain: string) {
        //get smtp settings
        return this.get_smtp_cfg().then((smtpSettings: any) => {
            let url = "https://" + domain + "/";
            let calls = [];
            //Set SMTP
            //let smtp = { web_url: url, port: smtpSettings.port, server: smtpSettings.server, email_from: smtpSettings.email_from, host: smtpSettings.hostname, ssl: smtpSettings.ssl, username: smtpSettings.username };
            let smtp = { web_url: url, port: "", server: "", host: "", ssl: false };
            calls.push(this.set_smtp_cfg(smtp));
            //SET WG
            calls.push(this.set_system_properties({ wireguard_public_address: domain }));
            //RDP URI
            calls.push(this.set_system_properties({ rdp_uri: url + "rdp" }));
            //SET PUSHTOTP
            let conf = { type: "", name: "", authentication_timeout: "180", cache_authentication_timeout: "900", mamori_service_url: url }
            conf.type = "pushtotp";
            conf.name = "pushtotp"
            calls.push(this.update_provider(conf.name, conf));
            //SET PUSHMOBILE
            conf.type = "pushmobile";
            conf.name = "pushmobile"
            calls.push(this.update_provider(conf.name, conf));
            return Promise.all(calls);
        })
    }


    public get_secrets(options: any): Promise<any> {
        return this.callAPI("GET", "/v1/secrets/", options);
    }

    public get_secret(id: number | string): Promise<any> {
        return this.callAPI("GET", "/v1/secrets/" + id);
    }

    public get_secret_parts(id: number | string): Promise<any> {
        return this.callAPI("GET", "/v1/secrets/" + id + "/parts");
    }

    public reveal_secret(id: number | string): Promise<any> {
        return this.callAPI("GET", "/v1/secrets/" + id + "/reveal");
    }

    public create_secret(secret: any): Promise<any> {
        return this.callAPI("POST", "/v1/secrets/", { secret });
    }

    public restore_secret(secret: any, key?: string): Promise<any> {
        if (key) {
            return this.callAPI("POST", "/v1/secrets/", { restore: true, key, secret });
        }

        return this.callAPI("POST", "/v1/secrets/", { restore: true, secret });
    }

    public export_secret(name: string, key?: string): Promise<any> {
        if (key) {
            return this.callAPI("GET", "/v1/secrets/" + encodeURIComponent(name) + "/export?key=" + encodeURIComponent(key));
        }

        return this.callAPI("GET", "/v1/secrets/" + encodeURIComponent(name) + "/export");
    }

    public update_secret(id: number | string, secret: any): Promise<any> {
        return this.callAPI("PUT", "/v1/secrets/" + id, { secret });
    }

    public delete_secret(id: number | string): Promise<any> {
        return this.callAPI("DELETE", "/v1/secrets/" + id);
    }

    public reset_secret_alert(id: number | string, alert_at: string): Promise<any> {
        return this.callAPI("PUT", "/v1/secrets/" + id + "/reset_alert", { alert_at });
    }

}

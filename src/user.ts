/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { LoginResponse, MamoriService } from './api';
import { ISerializable } from "./i-serializable";
import { prepareFilter } from './utils';

/**
 * Multi-Factor Authentication (MFA) provider types available for user authentication
 */
export enum MFA_PROVIDER {
    /** No MFA provider */
    NONE = "none",
    /** Push-to-TOTP authentication */
    PUSHTOTP = "pushtotp",
    /** Push mobile authentication */
    PUSHMOBILE = "pushmobile",
    /** Time-based One-Time Password (TOTP) */
    TOTP = "totp",
    /** YubiKey authentication */
    YUBIKEY = "yubikey",
    /** Online YubiKey authentication */
    ONLINEYUBIKEY = "onlineyubikey",
    /** Service account authentication */
    SERVICE = "service",
    /** Duo Security authentication */
    DUO = "duo",
    /** Unloq authentication */
    UNLOQ = "unloq",
    /** SaasPass authentication */
    SAASPASS = "saaspass",
    /** Azure AD authentication */
    AZURE = "azure",
    /** TechPass authentication */
    TECHPASS = "techpass",
    /** Azure OAuth authentication */
    AZUREOAUTH = "azureoauth",
    /** Okta authentication */
    OKTA = "okta",
    /** PingID authentication */
    PINGID = "pingid"
}

/**
 * MFA apply scopes (when a user MFA provider row is challenged).
 * Matches Hub {@code MfaApply} values.
 */
export enum MFA_APPLY {
    PORTAL_OAUTH = "portal_oauth",
    PORTAL_LOCAL_AUTH = "portal_local_auth",
    RESOURCE_ACCESS = "resource_access",
}

/** Default scopes for portal local login + resource access (DB proxy, etc.). */
export const MFA_SCOPES: MFA_APPLY[] = [
    MFA_APPLY.PORTAL_LOCAL_AUTH,
    MFA_APPLY.RESOURCE_ACCESS,
];

function quoteSqlLiteral(value: string): string {
    return "'" + String(value).replace(/'/g, "''") + "'";
}

function joinMfaApplies(applies: Array<MFA_APPLY | string>): string {
    return applies.map((a) => String(a)).filter((a) => a.length > 0).join(",");
}


class UserBase implements ISerializable {
    public constructor() {
    }

    username: string = "";
    email: string = "";
    fullname: string = "";


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

    /**
     * All roles granted, directly or indirectly.
     * @param api 
     * @param user  Optional user name. If null, use the logged-in user.
     * @returns Array of arrays of columns 'uuid', 'roleid', 'grantee', 'valid_from', 'valid_until'
     */
    public static async getAllGrantedRoles(api: MamoriService, user?: string): Promise<any> {
        let name = user || api.username || "";
        let result = await api.callAPI("GET", "/v1/roles?recursive=Y&grantee=" + encodeURIComponent(name.toLowerCase()));
        return result.rows;
    }

    /**
     * All roles directly granted.
     * @param api 
     * @param user  Optional user name. If null, use the logged-in user.
     * @returns Array of Role objects
     */
    public static getGrantedRoles(api: MamoriService, user?: string): Promise<any> {
        let name = user || api.username || "";
        return api.callAPI("GET", "/v1/roles?isdef=N&grantee=" + encodeURIComponent(name.toLowerCase()));
    }

    public static clearMFARequests(api: MamoriService, username: string, peer_public_key?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let sql = "CALL CLEAR_AUTHENTICATION_REQUESTS(':USERNAME')".replace(":USERNAME", username);
            api.select(sql).then(() => {
                if (peer_public_key) {
                    return api.wireguard_disconnect_peer(peer_public_key).then(() => {
                        resolve({ success: true, message: "User multi-factor cache and requests cleared." });
                    });
                } else {
                    return api.wireguard_disconnect_user(username).then(() => {
                        resolve({ success: true, message: "User multi-factor cache and requests cleared." });
                    });
                }
            }).catch((error: any) => {
                reject(error.message);
            });
        });
    }

    public disableAccount(api: MamoriService): Promise<any> {
        return api.disable_user(this.username);
    }

    public enableAccount(api: MamoriService): Promise<any> {
        return api.enable_user(this.username);
    }

    public unlockAccount(api: MamoriService): Promise<any> {
        return api.unlock_user(this.username);
    }

    /**
     * Export this user’s password hash encrypted with the named AES key (hub procedure `EXPORT_USER_PASSWORD_EX`).
     */
    public exportPassword(api: MamoriService, aesKeyName: string): Promise<any> {
        return api.call("EXPORT_USER_PASSWORD_EX", this.username, aesKeyName);
    }

    /**
     * Restore this user’s password from an encrypted export blob (hub procedure `RESTORE_USER_PASSWORD_EX`).
     * @param forUsername  If provided, passed as the procedure’s user argument instead of `this.username` (e.g. mismatch tests).
     */
    public restorePassword(
        api: MamoriService,
        encryptedValue: any,
        aesKeyName: string,
        forUsername?: string,
    ): Promise<any> {
        return api.call("RESTORE_USER_PASSWORD_EX", forUsername ?? this.username, encryptedValue, aesKeyName);
    }

    /**
     * Mark this directory user validated, then log in with the given password on a separate client and log that client out.
     * @param api  Logged-in service (e.g. admin) used to run `ALTER USER … SET VALIDATED`.
     * @param password  Plain password for this user.
     * @param otpPassword  Optional MFA one-time password for `MamoriService.login`.
     */
    public validateLogin(api: MamoriService, password: string, otpPassword?: string): Promise<LoginResponse> {
        const name = this.username;
        return api.select("ALTER USER " + name + " SET VALIDATED = TRUE").then(() => {
            const client = api.createClient();
            return client.login(name, password, otpPassword).then((loginResult) =>
                client
                    .logout()
                    .then(() => loginResult)
                    .catch(() => loginResult),
            );
        });
    }
}


/**
  * A Mamori Directory User
  */
export class User extends UserBase {

    /**
     * Searches remote logins
     * NOTE: Non-admins will only be able to see their granted peers
     * @param api 
     * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
     * @returns users
    */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.users_search(payload);
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns This User configuration
     */
    public static get(api: MamoriService, username: string): Promise<User> {
        return api.user(username).then(result => {
            let u = new User(username).withEmail(result.email).withFullName(result.fullname);
            return u;
        });
    }

    /**
     * @param user fields as json
     * @returns 
     */
    public static build(user: any): User {
        let result = new User(user.username);
        return result;
    }

    /**
     * @param roleid  Unique Role name
     */
    public constructor(name: string) {
        super();
        this.username = name;
        this.email = "";
        this.fullname = "";
    }

    public withEmail(email: string): User {
        this.email = email;
        return this;
    }

    public withFullName(fullname: string): User {
        this.fullname = fullname;
        return this;
    }


    /**
     * Create a new user with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService, password?: string): Promise<any> {

        return api.create_user({
            username: this.username,
            fullname: this.fullname,
            password: password,
            identified_by: "password",
            email: this.email
        });
    }


    /**
     * Delete.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        return api.delete_user(this.username);
    }

    /**
     * Update this user with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public update(api: MamoriService): Promise<any> {
        return api.update_user(this.username, {
            email: this.email,
            fullname: this.fullname,
        });
    }

    /**
     * Set the Multi-Factor Authentication (MFA) provider for this user.
     * @param api  A logged-in MamoriService instance
     * @param provider  The MFA provider name (use MFA_PROVIDER enum values or string)
     * @param options  Optional provider-specific options as key-value pairs
     * @returns Promise that resolves when the MFA provider is set
     * 
     * @example
     * // Set pushtotp as MFA provider using enum
     * await user.setMFAProvider(api, MFA_PROVIDER.PUSHTOTP);
     * 
     * // Set pushtotp with options
     * await user.setMFAProvider(api, MFA_PROVIDER.PUSHTOTP, { key1: "value1", key2: "value2" });
     * 
     * // Set using string
     * await user.setMFAProvider(api, "pushtotp");
     * 
     * // Remove MFA provider
     * await user.setMFAProvider(api, MFA_PROVIDER.NONE);
     */
    public setMFAProvider(api: MamoriService, provider: MFA_PROVIDER | string, options?: { [key: string]: string }): Promise<any> {
        let userProperties: any = {
            authenticated_by_primary: {
                provider: provider,
                options: options || {}
            }
        };
        return api.update_user(this.username, userProperties);
    }

    /**
     * Set this user as a service account with the specified allowed IP address.
     * Service accounts authenticate based on the source IP address of the connection.
     * @param api  A logged-in MamoriService instance
     * @param allowedIp  The IPv4 address that is allowed to authenticate as this service account
     * @returns Promise that resolves when the service account is configured
     * 
     * @example
     * // Set user as service account with allowed IP
     * await user.setAsServiceAccount(api, "192.168.1.100");
     */
    public setAsServiceAccount(api: MamoriService, allowedIp: string): Promise<any> {
        return this.setMFAProvider(api, MFA_PROVIDER.SERVICE, {
            ALLOWED_IP: allowedIp
        });
    }

    /**
     * Assign a scoped MFA provider for the given apply types (Hub {@code SET_USER_SCOPED_MFA}).
     * Creates one {@code user_auth_providers} row per apply with non-null {@code mfa_apply}.
     */
    public setScopedMFA(
        api: MamoriService,
        provider: MFA_PROVIDER | string,
        applies: Array<MFA_APPLY | string> = MFA_SCOPES,
    ): Promise<any> {
        const sql =
            "CALL SYSCS_UTIL.SET_USER_SCOPED_MFA(" +
            quoteSqlLiteral(this.username) +
            ", " +
            quoteSqlLiteral(String(provider)) +
            ", " +
            quoteSqlLiteral(joinMfaApplies(applies)) +
            ")";
        return api.select(sql);
    }

    /**
     * Reset enrollment secrets for scoped MFA rows (Hub {@code RESET_USER_SCOPED_MFA}).
     * Rows for the given applies remain; secrets / QR are regenerated.
     */
    public resetScopedMFA(
        api: MamoriService,
        provider: MFA_PROVIDER | string,
        applies: Array<MFA_APPLY | string> = MFA_SCOPES,
    ): Promise<any> {
        const sql =
            "CALL SYSCS_UTIL.RESET_USER_SCOPED_MFA(" +
            quoteSqlLiteral(this.username) +
            ", " +
            quoteSqlLiteral(String(provider)) +
            ", " +
            quoteSqlLiteral(joinMfaApplies(applies)) +
            ")";
        return api.select(sql);
    }

    /**
     * Delete scoped MFA rows for the given apply types (Hub {@code DELETE_USER_SCOPED_MFA}).
     */
    public deleteScopedMFA(
        api: MamoriService,
        applies: Array<MFA_APPLY | string> = MFA_SCOPES,
    ): Promise<any> {
        const sql =
            "CALL SYSCS_UTIL.DELETE_USER_SCOPED_MFA(" +
            quoteSqlLiteral(this.username) +
            ", " +
            quoteSqlLiteral(joinMfaApplies(applies)) +
            ")";
        return api.select(sql);
    }

    /**
     * List {@code SYS.USER_AUTHENTICATION_PROVIDERS} rows for this user (includes {@code MFA_APPLY}).
     */
    public listAuthenticationProviders(api: MamoriService): Promise<any> {
        return api.select(
            "SELECT * FROM SYS.USER_AUTHENTICATION_PROVIDERS WHERE lower(user_name) = lower(" +
                quoteSqlLiteral(this.username) +
                ")",
        );
    }

    /**
     * Self-service: list MFA apply rows for the logged-in user ({@code GET /v1/my/mfa_apply}).
     * Call with an API session authenticated as this user.
     */
    public listMyMfaApply(api: MamoriService): Promise<any> {
        return api.list_my_mfa_apply();
    }

    /**
     * Self-service: enroll scoped MFA ({@code POST /v1/my/mfa_apply/enroll}).
     * Call with an API session authenticated as this user.
     */
    public enrollScopedMfa(api: MamoriService, provider?: string): Promise<any> {
        return api.enroll_scoped_mfa(provider);
    }

    /**
     * Admin HTTP: list MFA apply rows for this user ({@code GET /v1/users/:user/mfa_apply}).
     */
    public listUserMfaApply(api: MamoriService): Promise<any> {
        return api.list_user_mfa_apply(this.username);
    }

    /**
     * Admin HTTP: set scoped MFA ({@code PUT /v1/users/:user/mfa_apply}).
     */
    public setScopedMfaHttp(
        api: MamoriService,
        provider: MFA_PROVIDER | string,
        applies: Array<MFA_APPLY | string> = MFA_SCOPES,
    ): Promise<any> {
        return api.set_user_scoped_mfa(
            this.username,
            String(provider),
            applies.map((a) => String(a)),
        );
    }

    /**
     * Admin HTTP: delete scoped MFA applies ({@code DELETE /v1/users/:user/mfa_apply}).
     */
    public deleteScopedMfaHttp(
        api: MamoriService,
        applies: Array<MFA_APPLY | string> = MFA_SCOPES,
    ): Promise<any> {
        return api.delete_user_scoped_mfa(
            this.username,
            applies.map((a) => String(a)),
        );
    }

    /**
     * Admin HTTP: reset scoped MFA ({@code POST /v1/users/:user/mfa_apply/reset}).
     */
    public resetScopedMfaHttp(
        api: MamoriService,
        provider: MFA_PROVIDER | string,
        applies: Array<MFA_APPLY | string> = MFA_SCOPES,
    ): Promise<any> {
        return api.reset_user_scoped_mfa(
            this.username,
            String(provider),
            applies.map((a) => String(a)),
        );
    }

}



/**
  * A Mamori Directory User
  */
export class DirectoryUser extends UserBase {

    /**
    * Searches remote logins
    * NOTE: Non-admins will only be able to see their granted peers
    * @param api 
    * @param filter a filter in the format [["column1","=","value"],["column2","contains","value2"]]
    * @returns users
   */
    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.callAPI("PUT", "/v1/search/directory_users", payload);
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns This User configuration
     */
    public static get(api: MamoriService, username: string): Promise<User> {
        return api.user(username).then(result => {
            let u = new User(username).withEmail(result.email).withFullName(result.fullname);
            return u;
        });
    }


    /**
     * @param user fields as json
     * @returns 
     */
    public static build(user: any): User {
        let result = new User(user.username);
        return result;
    }

    provider: string;
    /**
     * @param roleid  Unique Role name
     */
    public constructor(provider: string, name: string) {
        super();
        this.username = name;
        this.provider = provider;
        this.email = "";
        this.fullname = "";
    }

    /**
     * Delete.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        return api.callAPI("POST", "/v1/directory_users", { provider: this.provider, username: this.username });
    }

    /**
     * Delete.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        return api.delete_external_user(this.username);
    }




}
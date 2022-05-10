/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */

import { MamoriService } from './api';



export enum DEFAULT_AUTH_PROVIDERS {
    ADMIN = "admin",
    PUSHMOBILE = "pushmobile",
    PUSHTOTP = "pushtotp",
    YUBIKEY = "yubikey",
    TOTP = "totp",
    PASSWORD = "password",
}


export class ServerSettings {

    api: MamoriService;

    /**
     * @param name  Service API object
     */
    public constructor(api: MamoriService) {
        this.api = api
    }

    /**
       * @param domain  server IP or dns entry
       */
    public setServerDomain(domain: string): Promise<any> {
        return this.api.setServerDomain(domain);
    }

    /**
     * @param enabled  Enable or disable the root login
     * @param password (Optional) update the password
     */
    public setBootstrapAccount(enabled: boolean, password?: string) {
        let options = {
            name: DEFAULT_AUTH_PROVIDERS.ADMIN,
            type: DEFAULT_AUTH_PROVIDERS.ADMIN,
            enabled: enabled ? "true" : "false",
        };
        if (password && password.trim().length > 0) {
            (options as any).password = password;
        }
        return this.api.update_provider(DEFAULT_AUTH_PROVIDERS.ADMIN, options)
    }





    /*
        has_license_permission(): boolean {
            if (this.claims &&
                this.claims.license_info && (permission in this.claims.license_info)) {
                return (this.claims.license_info.permission == "true");
            }
            return true;
        }
    */

}

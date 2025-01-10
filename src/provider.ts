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

export class Provider implements ISerializable {
    public provider_name: string;
    public provider_type: string ;
    public is_web_based: string;
    public is_mfa: string;
    public is_internal: string;
    public is_directory: string;
    public is_default: string;
    public image: any;
    public properties: any;

    public constructor() {
        this.provider_name = "";
        this.provider_type = "";
        this.properties = {};
        this.is_web_based = "";
        this.is_mfa =  '',
        this.is_internal = '',
        this.is_directory = '',
        this.is_default = '',
        this.image =  null;
    }

    public static list(api: MamoriService): Promise<any> {
        return api.providers();
    }

    public static get(api: MamoriService, name: String): Promise<any> {        
        return api.get_provider(name);
    }

    public static build(rec: any): Provider {
        return new Provider();
        /*
        if (rec.permissiontype == 'SSH') {
            return new SSHLoginPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'SFTP') {
            return new SFTPLoginPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'IP USAGE') {
            return new IPResourcePermission().fromJSON(rec);
        } else if (rec.permissiontype == 'RDP') {
            return new RemoteDesktopLoginPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'KEY USAGE') {
            return new KeyPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'CREDENTIAL USAGE') {
            return new CredentialPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'REVEAL SECRET') {
            return new SecretPermission().fromJSON(rec);
        } else if (rec.permissiontype == 'HTTP ACCESS') {
            return new HTTPResourcePermission().fromJSON(rec);
        } else if (Object.values(DB_PERMISSION).includes(rec.permissiontype)) {
            return new DatasourcePermission().permission(rec.permissiontype).fromJSON(rec);
        } else if (Object.values(MAMORI_PERMISSION).includes(rec.permissiontype)) {
            return new MamoriPermission([rec.permissiontype]).fromJSON(rec);
        } else {
            console.log("**** Permission.factory MISSING TYPE : %s", rec.permissiontype)
            return new PermissionBase();
        }
        */
        
        //
        //"UNAUTHENTICATED IP USAGE"
        //
        //""
        //POLICY
        //
    }


    fromJSON(record: any) {
        throw new Error('Method not implemented.');
    }
    toJSON() {
        throw new Error('Method not implemented.');
    }
}


export class DUOProvider extends Provider {


}


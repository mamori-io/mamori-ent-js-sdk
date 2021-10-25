/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { DMService } from './api';

 /**
  * A role and all the grantables.
  */
 export class Role {

    /**
     * @param api 
     * @returns All roles
     */
    public static getAll(api: DMService) : Promise<any> {
        return api.callAPI("GET", "/v1/roles?type=role");
    }

    /**
     * @param api 
     * @param user_or_role  Optional user or role name. If null, use the logged-in user.
     * @returns All roles granted, directly or indirectly.
     */
     public static getAllGrantedRoles(api: DMService, user_or_role?: string) : Promise<any> {
        let name = user_or_role || api.username || "" ;
        return api.callAPI("GET", "/v1/roles?recursive=Y&grantee=" + encodeURIComponent(name.toLowerCase()));
    }

    /**
     * @param api 
     * @param user_or_role  Optional user or role name. If null, use the logged-in user.
     * @returns All roles directly granted.
     */
     public static getGrantedRoles(api: DMService, user_or_role?: string) : Promise<any> {
        let name = user_or_role || api.username || "" ;
        return api.callAPI("GET", "/v1/roles/" + encodeURIComponent(name.toLowerCase()) + "/grantee?distinct=Y");
    }

    /**
     * @param role 
     * @returns 
     */
    public static build(role: any): Role {
        let result = new Role(role.name) ;
        result.externalName = role.externalName ;
        result.position = role.position ;

        return result ;
    }

    name: string ;
    externalName: string ;
    position: number ;

    /**
     * @param name  Unique Role name
     */
    public constructor(name: string) {
        this.name = name;
        this.externalName = "" ;
        this.position = 0 ;
    }

    /**
     * Create a new Role with the current properties.
     * @param api  A logged-in DMService instance
     * @returns 
     */
    public create(api: DMService) : Promise<any> {
        let options = {
            roleid: this.name,
            externalname: this.externalName,
            position: this.position,
        } ;
        return api.callAPI("POST", "/v1/roles", options);
    }

    /**
     * Delete this Role.
     * @param api  A logged-in DMService instance
     * @returns 
     */
     public delete(api: DMService) : Promise<any> {
        return api.callAPI("DELETE", "/v1/roles/" + this.name);
    }

    /**
     * @param api  A logged-in DMService instance
     * @returns This Role's configuration
     */
     public get(api: DMService) : Promise<any> {
        return api.callAPI("GET", "/v1/roles/" + this.name);
    }

    /**
     * Update this Role with the current properties.
     * @param api  A logged-in DMService instance
     * @returns 
     */
     public update(api: DMService) : Promise<any> {
        return api.callAPI("PUT", "/v1/roles/" + this.name, {
            roleid: this.name,
            externalname: this.externalName,
            position: this.position,
        });
    }

    /**
     * @param api 
     * @param grantables       Array of permissions.
     * @param object_name      Optional object, e.g. a table <datasource>.<database>.<schema>.<table>
     * @param withGrantOption  Optional.
     * @returns 
     */
     public grant(api: DMService, grantables: string[], object_name?: string, withGrantOption?: boolean) : Promise<any> {
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent(this.name.toLowerCase()), {
            grantables: grantables,
            object_name: object_name,
            with_grant_option: withGrantOption,
        });
    }

    /**
     * @param api 
     * @param grantables       Array of permissions.
     * @param object_name      Optional object, e.g. a table <datasource>.<database>.<schema>.<table>
     * @returns 
     */
     public revoke(api: DMService, grantables: string[], object_name?: string) : Promise<any> {
        return api.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(this.name.toLowerCase()), {
            grantables: grantables,
            object_name: object_name
        });
    }

    /**
     * @param api  A logged-in DMService instance
     * @returns All users and roles this Role has been granted to, directly or indirectly.
     */
     public getGrantees(api: DMService) : Promise<any> {
        return api.callAPI("GET", "/v1/roles/" + this.name);
    }

    /**
     * @param externalName  Role display name
     * @returns 
     */
    public as(externalName: string) : Role {
        this.externalName = externalName;
        return this ;
    }

    /**
     * @param position  Role position or priority
     * @returns 
     */
     public at(position: number) : Role {
        this.position = position;
        return this ;
    }
}

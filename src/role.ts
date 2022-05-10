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
import { TIME_UNIT } from './permission';


export interface RoleGrant {
    roleid: string;
    externalname?: string;
    position?: string;
    withadminoption: string;

    uuid: string;
    isdef: string;
    grantable?: string;
    grantee: string;
    grantor: string;
    lastupdate: string;
    valid_from?: string;
    valid_until?: string;
}

/**
  * A role.
  */
export class Role implements ISerializable {

    /**
     * @param api 
     * @returns All roles
     */
    public static getAll(api: MamoriService): Promise<any> {
        //return api.callAPI("GET", "/v1/roles?isdef=Y");
        return api.select(
            "SELECT roleid,position,lastupdate FROM (select * from SYS.SYSROLES WHERE lower(isDef) = 'y' AND roleid <> 'public') a ");
    }



    /**
     * @param role
     * @returns 
     */
    public static build(role: any): Role {
        let result = new Role(role.roleid, role.externalName);
        result.position = role.position;

        return result;
    }

    /**
    * grant option for a duration of time
    * @param TIME_UNIT
    * @param amount 
    * @returns 
    */
    public static optionValidFor(unit: TIME_UNIT, value: number): any {
        return { valid_unit: unit, valid_duration: value };
    }

    public static optionValidFrom(from: string): any {
        return { valid_from: from };
    }

    public static optionValidUntil(until: string): any {
        return { valid_until: until };
    }

    public static optionValidBetween(from: string, until: string): any {
        return { valid_from: from, valid_until: until };
    }

    roleid: string;
    externalname?: string;
    position?: string;
    withadminoption: string;

    /**
     * @param roleid  Unique Role name
     */
    public constructor(roleid: string, externalname: string = "") {
        this.roleid = roleid;
        this.externalname = externalname;

        this.withadminoption = 'N';
    }

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
     * Create a new Role with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        let options = {
            roleid: this.roleid,
            externalname: this.externalname,
            position: this.position,
        };
        return api.callAPI("POST", "/v1/roles", options);
    }

    /**
     * Delete this Role.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public delete(api: MamoriService): Promise<any> {
        return api.callAPI("DELETE", "/v1/roles/" + this.roleid);
    }

    /**
     * @param api  A logged-in MamoriService instance
     * @returns This Role's configuration
     */
    public get(api: MamoriService): Promise<RoleGrant> {
        return api.callAPI("GET", "/v1/roles/" + this.roleid);
    }

    /**
     * Update this Role with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns 
     */
    public update(api: MamoriService): Promise<any> {
        return api.callAPI("PUT", "/v1/roles/" + this.roleid, {
            roleid: this.roleid,
            externalname: this.externalname,
            position: this.position,
        });
    }

    /**
     * Grant permissions to this role.
     * @param api 
     * @param grantables       E.g. ROLE
     * @param object_name      Optional object, e.g. a table <datasource>.<database>.<schema>.<table>
     * @param withGrantOption  Optional.
     * @returns 
     */
    public grant(api: MamoriService, grantables: string[], object_name?: string, withGrantOption?: boolean, options?: any): Promise<any> {
        return api.grant_to(this.roleid, grantables, object_name, withGrantOption, options);
    }

    /**
     * Grant this role to a user or role.
     * @param api 
     * @param user_or_role 
     * @returns 
     */
    public grantTo(api: MamoriService, user_or_role: string, grantable: boolean, options?: any): Promise<any> {
        return api.grant_to(user_or_role, [this.roleid], null, grantable, options);
    }

    /**
     * Revoke permissions from this role.
     * @param api 
     * @param grantables       E.g. ROLE
     * @param object_name      Optional object, e.g. a table <datasource>.<database>.<schema>.<table>
     * @returns 
     */
    public revoke(api: MamoriService, grantables: string[], object_name?: string, options?: any): Promise<any> {
        return api.revoke_from(this.roleid, grantables, object_name, options);
    }

    /**
     * Revoke this role from a user or role.
     * @param api 
     * @param user_or_role
     * @returns 
     */
    public revokeFrom(api: MamoriService, user_or_role: string, options?: any): Promise<any> {
        return api.revoke_from(user_or_role, [this.roleid], options);
    }

    /**
     * All users or roles this Role has been directly granted to.
     * @param api  A logged-in MamoriService instance
     * @returns Array of RoleGrant objects with an extra type attribute with values: role or user.
     */
    public getGrantees(api: MamoriService): Promise<any> {
        return api.get_granted_roles(this.roleid.toLocaleLowerCase());
    }

    public getGranteesRecursive(api: MamoriService): Promise<any> {
        return api.get_granted_roles_recursive(this.roleid.toLocaleLowerCase());
    }

    /**
     * All roles granted, directly or indirectly.
     * @param api 
     * @param user_or_role  Optional user or role name. If null, use the logged-in user.
     * @returns Array of arrays of columns 'uuid', 'roleid', 'grantee', 'valid_from', 'valid_until'
     */
    public getAllGrantedRoles(api: MamoriService): Promise<any> {
        return api.get_grantee_roles_recursive(this.roleid.toLocaleLowerCase());
    }

    /**
     * All roles directly granted.
     * @param api 
     * @param user_or_role  Optional user or role name. If null, use the logged-in user.
     * @returns Array of Role objects
     */
    public getGrantedRoles(api: MamoriService): Promise<any> {
        return api.get_grantee_roles(this.roleid.toLocaleLowerCase());
    }

    /**
     * @param position  Role position or priority
     * @returns 
     */
    public at(position: string): Role {
        this.position = position;
        return this;
    }
}

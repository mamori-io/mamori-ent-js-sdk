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
     * All roles granted, directly or indirectly.
     * @param api 
     * @param user_or_role  Optional user or role name. If null, use the logged-in user.
     * @returns Array of arrays of columns 'uuid', 'roleid', 'grantee', 'valid_from', 'valid_until'
     */
    public static async getAllGrantedRoles(api: MamoriService, user_or_role?: string): Promise<any> {
        let name = user_or_role || api.username || "";
        let result = await api.callAPI("GET", "/v1/roles?recursive=Y&grantee=" + encodeURIComponent(name.toLowerCase()));
        return result.rows;
    }

    /**
     * All roles directly granted.
     * @param api 
     * @param user_or_role  Optional user or role name. If null, use the logged-in user.
     * @returns Array of Role objects
     */
    public static getGrantedRoles(api: MamoriService, user_or_role?: string): Promise<any> {
        let name = user_or_role || api.username || "";
        return api.callAPI("GET", "/v1/roles?isdef=N&grantee=" + encodeURIComponent(name.toLowerCase()));
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
    public grant(api: MamoriService, grantables: string[], object_name?: string, withGrantOption?: boolean): Promise<any> {
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent(this.roleid.toLowerCase()), {
            grantables: grantables,
            object_name: object_name,
            with_grant_option: withGrantOption,
        });
    }

    /**
     * Grant this role to a user or role.
     * @param api 
     * @param user_or_role 
     * @returns 
     */
    public grantTo(api: MamoriService, user_or_role: string): Promise<any> {
        return api.callAPI("POST", "/v1/roles/" + this.roleid + "/user", { selected_user: user_or_role });
    }

    /**
     * Revoke permissions from this role.
     * @param api 
     * @param grantables       E.g. ROLE
     * @param object_name      Optional object, e.g. a table <datasource>.<database>.<schema>.<table>
     * @returns 
     */
    public revoke(api: MamoriService, grantables: string[], object_name?: string): Promise<any> {
        return api.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(this.roleid.toLowerCase()), {
            grantables: grantables,
            object_name: object_name
        });
    }

    /**
     * Revoke this role from a user or role.
     * @param api 
     * @param user_or_role
     * @returns 
     */
    public revokeFrom(api: MamoriService, user_or_role: string): Promise<any> {
        return api.callAPI("DELETE", "/v1/roles/" + this.roleid + "/user", { selected_user: user_or_role });
    }

    /**
     * All users or roles this Role has been directly granted to.
     * @param api  A logged-in MamoriService instance
     * @returns Array of RoleGrant objects with an extra type attribute with values: role or user.
     */
    public getGrantees(api: MamoriService): Promise<any> {
        let sql =
            "SELECT g.*, CASE WHEN EXISTS(SELECT 1 FROM SYS.SYSROLES r WHERE r.isDef = 'Y' AND r.roleid = g.grantee) THEN 'role' ELSE 'user' END AS type" +
            "  FROM SYS.SYSROLES g" +
            " WHERE g.isDef = 'N'" +
            "   AND g.roleId = '" + this.roleid + "'";
        return api.select(sql);
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

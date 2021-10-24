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
    public static async getAll(api: DMService) {
        return api.callAPI("GET", "/v1/roles?distinct=Y");
    }

    /**
     * 
     * @param api 
     * @returns All the types of grantables
     */
     public static async getGrantableTypes(api: DMService) {
        // TODO
        return api.callAPI("GET", "/v1/roles/grantee");
    }

    /**
     * 
     * @param api 
     * @param type  A type of grantable
     * @returns All the grantables of the given type
     */
     public static async getGrantablesByType(api: DMService, type: string) {
        // TODO
        return api.callAPI("GET", "/v1/roles/" + type + "/grantee");
    }

    /**
     * 
     * @param api 
     * @param roleid 
     * @returns All roles granted to this user or role, directly or indirectly.
     */
     public static async getGranteeRoles(api: DMService, roleid: string) {
        return api.callAPI("GET", "/v1/roles/" + roleid + "/grantee");
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
    public async create(api: DMService) {
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
     public async delete(api: DMService) {
        return api.callAPI("DELETE", "/v1/roles/" + this.name);
    }

    /**
     * @param api  A logged-in DMService instance
     * @returns This Role's configuration
     */
     public async get(api: DMService) {
        return api.callAPI("GET", "/v1/roles/" + this.name);
    }

    /**
     * Update this Role with the current properties.
     * @param api  A logged-in DMService instance
     * @returns 
     */
     public async update(api: DMService) {
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
     public async grant(api: DMService, grantables: string[], object_name?: string, withGrantOption?: boolean) {
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
     public async revoke(api: DMService, grantables: string[], object_name?: string) {
        return api.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(this.name.toLowerCase()), {
            grantables: grantables,
            object_name: object_name
        });
    }

    /**
     * @param api  A logged-in DMService instance
     * @returns All users and rols this Role has been granted to, directly or indirectly.
     */
     public async getGrantees(api: DMService) {
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

    // public get_grantee_roles(roleid: string) {
    //     return this.callAPI("GET", "/v1/roles/" + roleid + "/grantee");
    // }

    // public get_grantee_grantable_roles(roleid: string) {
    //     return this.callAPI("GET", "/v1/roles/" + roleid + "/grantee/grantable");
    // }


    // public get_roles_with_grantable(roleid: string) {
    //     return this.callAPI("GET", "/v1/roles/" + roleid + "/roles");
    // }

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

    // public get_role_credentials(role: string) {
    //     return this.callAPI("GET", "/v1/roles/" + role + "/credentials");
    // }

    // public update_role_credentials(role: string, deleted_creds: string[], new_creds: string[]) {
    //     if (deleted_creds.length > 0 && new_creds.length > 0) {
    //         return this.callAPI("PUT", "/v1/roles/" + role + "/credentials", {
    //             db_credentials: new_creds,
    //             deleted_credentials: deleted_creds
    //         });
    //     }
    //     else if (deleted_creds.length > 0) {
    //         return this.drop_role_credentials(role, deleted_creds);

    //     } else if (new_creds.length) {
    //         return this.add_role_credentials(role, new_creds);
    //     }
    // }

    // public drop_role_credentials(role: string, credentials: string[]) {
    //     return this.callAPI("DELETE", "/v1/roles/" + role + "/credentials", {db_credentials: credentials});
    // }

    // public add_role_credentials(role: string, credentials: string[]) {
    //     return this.callAPI("POST", "/v1/roles/" + role + "/credentials", {db_credentials: credentials});
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

    // public attach_roles(name: string, roles: string[]) {
    //     return this.callAPI("POST", "/v1/roles/" + name + "/attach", roles);
    // }


    // public grantees() {
    //     return this.callAPI("GET", "/v1/grantees");
    // }

    // public get_grantee_policies(grantee: string) {
    //     return this.callAPI("GET", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/policies");
    // }

    // public grant(grantee: string, grantable: string, object_name:string) {
    //     return this.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()),
    //         {grantables: [grantable] ,object_name: object_name});
    // }

    // public user_roles(username: string) {
    //     return this.callAPI("GET", "/v1/roles?isdef=N&grantee=" + encodeURIComponent(username.toLowerCase()));
    // }

    // public user_roles_recursive(username: string) {
    //     return this.callAPI("GET", "/v1/roles?recursive=Y&grantee=" + encodeURIComponent(username.toLowerCase()));
    // }

    // public users_roles_recursive(userlist: string[]) {
    //     return this.callAPI("GET", "/v1/roles?recursive=Y",{grantee: userlist});
    // }


    // public grant_roles_to_user(username: string, roles: string[]) {
    //     return this.callAPI("POST", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/roles", {selected_roles: roles});
    // }

    // public revoke_roles_from_user(username: string, roles: string[]) {
    //     return this.callAPI("DELETE", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/roles", {selected_roles: roles});
    // }

    // public update_user_roles(username: string, deleted: string[], added: string[]) {
    //     if (deleted.length > 0 && added.length > 0) {
    //         return this.callAPI("PUT", "/v1/users/" + encodeURIComponent(username.toLowerCase()) + "/roles", {
    //             selected_roles: added,
    //             deleted_roles: deleted
    //         });
    //     }
    //     else if (deleted.length > 0) {
    //         return this.revoke_roles_from_user(username, deleted);
    //     } else if (added.length > 0) {
    //         return this.grant_roles_to_user(username, added);
    //     } else {
    //         return
    //     }
    // }

    // public revoke_role_from_users(roleid: string, users: string[]) {
    //     return this.callAPI("DELETE", "/v1/roles/" + roleid + "/users", {selected_users: users});
    // }

    // public revoke_role_from_grantee(roleid: string, grantee: string) {
    //     return this.callAPI("DELETE", "/v1/roles/" + roleid + "/user", {selected_user: grantee});
    // }

    // public grant_role_to_users(roleid: string, users: string[]) {
    //     return this.callAPI("POST", "/v1/roles/" + roleid + "/users", {selected_users: users});
    // }

    // public grant_role_to_grantee(roleid: string, grantee: string) {
    //     return this.callAPI("POST", "/v1/roles/" + roleid + "/user", {selected_user: grantee});
    // }

    // //delete a specific role
    // public delete_role(roleid: string) {
    //     return this.callAPI("DELETE", "/v1/roles/" + roleid);
    // }
    
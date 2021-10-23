/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { DMService, LoginResponse } from './api';

 /**
  * A datasource represents a target database.
  * 
  * Example use:
  * ```javascript
  * await new Datasource("test")
  *     .ofType("POSTGRESQL", 'postgres')
  *     .at("10.0.2.2", 5432)
  *     .withCredentials('postgres', 'postgres')
  *     .withDatabase('mamori')
  *     .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true')
  *     .create(api) ;
  * ```
  * or
  * ```javascript
  * await Datasource.build({
  *     name: "test", 
  *     type: "POSTGRESQL", 
  *     driver: "postgres", 
  *     host: "10.0.2.2", 
  *     port: 5432
  *     user: "postgres",
  *     password: "postgres",
  *     database: "mamori",
  *     urlProperties: "allowEncodingChanges=true;defaultNchar=true"
  * }).create(api)
  * ```
  * 
  * TODO Add user/role credentials/authorization for this database
  */
 export class Datasource {

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): Datasource {
        let result = new Datasource(ds.name) ;
        result.type = ds.type ;
        result.driver = ds.driver ;
        result.host = ds.host ;
        result.port = ds.port ;
        result.group = ds.group ;
        result.user = ds.user ;
        result.password = ds.password ;
        result.tempDatabase = ds.tempDatabase ;
        result.database = ds.database ;
        result.urlProperties = ds.cxnOptions ;
        result.caseSensitive = ds.caseSensitive ;
        result.extraOptions = ds.extraOptions ;

        return result ;
    }

    name: string ;
    type?: string ;
    driver?: string ;
    host?: string ;
    port?: string ;
    group?: string ;
    user?: string ;
    password?: string ;
    tempDatabase?: string;
    database?: string ;
    caseSensitive?: boolean ;
    urlProperties?: string ;
    extraOptions?: string ;

    /**
     * @param name  Unique datasource name
     */
    public constructor(name: string) {
        this.name = name;
    }

    /**
     * Create a new datasource with the current properties.
     * @param api  A logged-in DMService instance
     * @returns 
     */
    public async create(api: DMService) {
        var options = this.makeOptionsSql();
        let loggedInUser = (api.authorization as unknown as LoginResponse).username ;
        let auth = { a: { system_name: this.name, cirro_user: loggedInUser, username: this.user, password: this.password }};
        
        return api.callAPI("POST", "/v1/systems", {preview: 'N',
                           system: { name: this.name, type: this.type, host: this.host }, 
                           options: options, 
                           authorizations: auth});
    }

    /**
     * Delete this datasource.
     * @param api  A logged-in DMService instance
     * @returns 
     */
     public async delete(api: DMService) {
        return api.callAPI("DELETE", "/v1/systems/" + this.name);
    }

    /**
     * Update this datasource with the current properties.
     * @param api  A logged-in DMService instance
     * @returns 
     */
     public async update(api: DMService) {
        var options = this.makeOptionsSql();
        let loggedInUser = (api.authorization as unknown as LoginResponse).username ;
        let auth = { a: { system_name: this.name, cirro_user: loggedInUser, username: this.user, password: this.password }};
        
        return api.callAPI("PUT", "/v1/systems/" + this.name, 
            {
                preview: "N", 
                system: { type: this.type, host: this.host }, 
                options: options, 
                authorizations: auth
            });
    }

    /**
     * @param api  A logged-in DMService instance
     * @returns This datasource's configuration
     */
     public async get(api: DMService) {
        return api.callAPI("GET", "/v1/systems/" + this.name);
    }

    /**
     * @param type   Required datasource type, e.g. ORACLE, POSTGRESQL, SQL_SERVER
     * @param driver Required datasource name
     * @returns 
     */
    public ofType(type: string, driver: string) : Datasource {
         this.type = type;
         this.driver = driver;
         return this ;
    }

    /**
     * Set the address of the target resource
     * @param host  Required host name or IP address of the target resource
     * @param port  Required listening port of the target resource
     * @returns 
     */
    public at(host: string, port: any) : Datasource {
        this.host = host;
        this.port = port;
        return this ;
    }

    /**
     * @param group  Optional datasource group
     * @returns 
     */
     public inGroup(group: string) : Datasource {
        this.group = group;
        return this ;
    }

    /**
     * Set the creadentials to use when connecting to the target resource
     * @param user      Required user name
     * @param password  Required password
     * @returns 
     */
   public withCredentials(user: string, password: string) : Datasource {
        this.user = user;
        this.password = password;
        return this ;
    }

    /**
     * For some databases, a database name is required to connect.
     * @param database  Optional default database
     * @returns 
     */
    public withDatabase(database: string) : Datasource {
        this.database = database;
        if (this.tempDatabase) {
            // Do not override
        }
        else {
            this.tempDatabase = database ;
        }
        return this ;
    }

    /**
     * A database name is required for any temporary tables.
     * Defaults to the database value if not set.
     * @param database  Database for any temporary tables.
     * @returns 
     */
     public withTempDatabase(tempDatabase: string) : Datasource {
        this.tempDatabase = tempDatabase;
        return this ;
    }

    /**
     * @param caseSensitive  Optionally specify case sensitivity of the datasource names. Default: false  
     * @returns 
     */
     public withCaseSensitive(caseSensitive: boolean) : Datasource {
        this.caseSensitive = caseSensitive;
        return this ;
    }

    /**
     * @param urlProperties  Optional properties to add to the JDBC URL
     * @returns 
     */
   public withConnectionProperties(urlProperties: string) : Datasource {
        this.urlProperties = urlProperties;
        return this ;
    }

    /**
     * More options are available in the full SQL syntax.
     * E.g., "POOL_MAXIMUM '3', ENABLED FALSE"
     * @param extraOptions  Optional extras
     * @returns 
     */
     public withOptions(extraOptions: string) : Datasource {
        this.extraOptions = extraOptions;
        return this ;
    }

    private makeOptionsSql() {
        var options =
            "DRIVER '" + this.driver + "'" +
            ", USER '" + this.user + "'" +
            ", PASSWORD '" + this.password + "'";
        if (this.port) {
            options = options + ", PORT '" + this.port + "'";
        }
        if (this.tempDatabase) {
            options = options + ", TEMPDATABASE '" + this.tempDatabase + "'";
        }
        else if (this.database) {
            options = options + ", TEMPDATABASE '" + this.database + "'";
        }
        if (this.database) {
            options = options + ", DEFAULTDATABASE '" + this.database + "'";
        }
        if (this.caseSensitive) {
            options = options + ", OBJECTNAMECASESENSITIVE 'TRUE'" ;
        }
        if (this.group) {
            options = options + ", DATASOURCE GROUP '" + this.group + "'";
        }
        if (this.urlProperties) {
            options = options + ", CONNECTION_PROPERTIES '" + this.urlProperties + "'";
        }
        if (this.extraOptions) {
            options = options + ", " + this.extraOptions;
        }
        return options;
    }

    // return all users/roles and which systems they are authorized to access
    // public get_role_authorization_by_system(params?: any) {
    //     return this.callAPI("GET", "/v1/roles/auth/systems", params);
    // }

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
}

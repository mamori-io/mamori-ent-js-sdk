/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService, LoginResponse } from './api';
import { ISerializable } from "./i-serializable";
import { CREDENTIAL_RESET_OPTIONS } from './utils';

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
 */
export class Datasource implements ISerializable {

    /**
     * @param api
     * @returns All the datasources the logged-in user has access to.
     */
    public static getAll(api: MamoriService): Promise<any> {
        return api.callAPI("GET", '/v1/objects/databases?usersystems=true');
    }

    /**
     * @param api
     * @returns The database drivers configured.
     */
    public static getDrivers(api: MamoriService): Promise<any> {
        return api.callAPI("GET", '/v1/drivers');
    }

    /**
     * @param api
     * @returns The datasource types supported.
     */
    public static getTypes(api: MamoriService): Promise<any> {
        return api.callAPI("GET", '/v1/driver_types');
    }

    /**
     * @param ds
     * @returns
     */
    public static build(ds: any): Datasource {
        return new Datasource(ds.name).fromJSON(ds);
    }

    name: string;
    type?: string;
    driver?: string;
    host?: string;
    port?: string;
    group?: string;
    user?: string;
    password?: string;
    tempDatabase?: string;
    database?: string;
    caseSensitive?: boolean;
    enabled?: boolean;
    urlProperties?: string;
    extraOptions?: string;
    credential_reset_days?: string;
    credential_role?: string;
    connection_string?: string;

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
     * @param name  Unique datasource name
     */
    public constructor(name: string) {
        this.name = name;
    }

    /**
     * Create a new datasource with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns
     */
    public create(api: MamoriService): Promise<any> {
        var options = this.makeOptionsSql();
        let loggedInUser = (api.authorization as unknown as LoginResponse).username;
        //let auth = this.credential_reset_days ? [] : { a: { system_name: this.name, mamori_user: loggedInUser, username: this.user, password: this.password } };
        return api.callAPI("POST", "/v1/systems", {
            preview: 'N',
            system: { name: this.name, type: this.type, host: this.host },
            options: options,
            authorizations: []
        });
    }


    /**
     * Delete this datasource.
     * @param api  A logged-in MamoriService instance
     * @returns
     */
    public delete(api: MamoriService): Promise<any> {
        return api.callAPI("DELETE", "/v1/systems/" + this.name);
    }

    /**
     * Update this datasource with the current properties.
     * @param api  A logged-in MamoriService instance
     * @returns
     */
    public update(api: MamoriService, properties: any): Promise<any> {
        var options = this.makeUpdateOptionsSQL(properties);
        //let loggedInUser = (api.authorization as unknown as LoginResponse).username;
        //let auth: any = {};
        //if (this.authChanged(properties)) {
        //    auth = { a: { system_name: properties.name, mamori_user: loggedInUser, username: properties.user, password: properties.password } };
        //}

        return api.callAPI("PUT", "/v1/systems/" + this.name, {
            preview: "N",
            system: { type: this.type, host: this.host },
            options: options,
            authorizations: []
        });
    }

    private authChanged(properties: any): boolean {
        return (properties.user || properties.password || properties.name);
    }



    /**
     * @param api  A logged-in MamoriService instance
     * @returns This datasource's configuration
     */
    public get(api: MamoriService): Promise<Datasource> {
        return api.callAPI("GET", "/v1/systems/" + this.name);
    }

    /**
     *
     * @param api
     * @param grantee    A user or role to be granted a credential to access this datasource.
     * @param dbUser     Database user
     * @param dbPassword Database user's password
     * @returns
     */
    public addCredential(api: MamoriService, grantee: string, dbUser: string, dbPassword: string) {
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/datasource_authorization", {
            datasource: this.name,
            username: dbUser,
            password: dbPassword
        });
    }

    /**
     *
     * @param api
     * @param grantee    A user or role to be granted a credential to access this datasource.
     * @param dbUser     Database user
     * @param dbPassword Database user's password
     * @param resetDays  Number of days for password reset
     * @returns
     */
    public addCredentialWithManagedPassword(api: MamoriService, grantee: string, dbUser: string, dbPassword: string, resetDays: string) {
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/datasource_authorization", {
            datasource: this.name,
            username: dbUser,
            password: dbPassword,
            reset_days: resetDays
        });
    }

    /**
     * @param api
     * @param grantee    A user or role with a credential to access this datasource.
     * @returns
     */
    public removeCredential(api: MamoriService, grantee: string) {
        return api.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/datasource_authorization", { datasource: this.name });
    }

    /**
     * Validate credential details.
     * @param api
     * @param grantee    A user or role to be granted a credential to access this datasource.
     * @param dbUser     Database user
     * @param dbPassword Database user's password
     * @returns
     */
    public validateCredential(api: MamoriService, grantee: string, dbUser: string, dbPassword: string) {
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/datasource_authorization/validate", {
            datasource: this.name,
            username: dbUser,
            password: dbPassword
        });
    }

    /**
     * @param type   Required datasource type, e.g. ORACLE, POSTGRESQL, SQL_SERVER
     * @param driver Required datasource name
     * @returns
     */
    public ofType(type: string, driver: string): Datasource {
        this.type = type;
        this.driver = driver;
        return this;
    }

    /**
     * Set the address of the target resource
     * @param host  Required host name or IP address of the target resource
     * @param port  Required listening port of the target resource
     * @returns
     */
    public at(host: string, port: any): Datasource {
        this.host = host;
        this.port = port;
        this.connection_string = '';
        return this;
    }

    /**
     * @param group  Optional datasource group
     * @returns
     */
    public inGroup(group: string): Datasource {
        this.group = group;
        return this;
    }

    /**
     * Set the creadentials to use when connecting to the target resource
     * @param user      Required user name
     * @param password  Required password
     * @returns
     */
    public withCredentials(user: string, password: string): Datasource {
        this.user = user;
        this.password = password;
        return this;
    }

    /**
     * For some databases, a database name is required to connect.
     * @param database  Optional default database
     * @returns
     */
    public withDatabase(database: string): Datasource {
        this.database = database;
        if (this.tempDatabase) {
            // Do not override
        }
        else {
            this.tempDatabase = database;
        }
        return this;
    }

    /**
     * A database name is required for any temporary tables.
     * Defaults to the database value if not set.
     * @param database  Database for any temporary tables.
     * @returns
     */
    public withTempDatabase(tempDatabase: string): Datasource {
        this.tempDatabase = tempDatabase;
        return this;
    }

    /**
     * @param caseSensitive  Optionally specify case sensitivity of the datasource names. Default: false
     * @returns
     */
    public withCaseSensitive(caseSensitive: boolean): Datasource {
        this.caseSensitive = caseSensitive;
        return this;
    }

    /**
     * @param enabled  Optionally enable or disable this datasource
     * @returns
     */
    public enable(enabled: boolean): Datasource {
        this.enabled = enabled;
        return this;
    }

    /**
     * @param urlProperties  Optional properties to add to the JDBC URL
     * @returns
     */
    public withConnectionProperties(urlProperties: string): Datasource {
        this.urlProperties = urlProperties;
        return this;
    }

    public withConnectionString(value: string): Datasource {
        this.connection_string = value;
        this.host = "";
        this.port = "";
        this.withDatabase("");
        return this;
    }

    /**
     * More options are available in the full SQL syntax.
     * E.g., "POOL_MAXIMUM '3', ENABLED FALSE"
     * @param extraOptions  Optional extras
     * @returns
     */
    public withOptions(extraOptions: string): Datasource {
        this.extraOptions = extraOptions;
        return this;
    }

    public withPasswordPolicy(resetDays: string, credentialRole: string): Datasource {
        this.credential_reset_days = resetDays;
        this.credential_role = credentialRole;
        return this;
    }

    private generateOptionsSQL(rec: any, update?: boolean): any {
        let res: any[] = [];

        if (update && rec.host) {
            res.push("HOST '" + rec.host + "'");
        }

        if (rec.driver) {
            res.push("DRIVER '" + rec.driver + "'");
        }
        if (rec.user) {
            res.push("USER '" + rec.user + "'");
        }
        if (rec.password) {
            res.push("PASSWORD '" + rec.password + "'");
        }

        if (rec.credential_reset_days && rec.credential_reset_days.length > 0) {
            res.push(CREDENTIAL_RESET_OPTIONS.CRED_RESET_DAYS + " '" + rec.credential_reset_days + "'");
        }
        if (rec.credential_role && rec.credential_role.length > 0) {
            res.push(CREDENTIAL_RESET_OPTIONS.CRED_ROLE + " '" + rec.credential_role + "'");
        }

        if (rec.port) {
            res.push("PORT '" + rec.port + "'");
        }
        if (rec.tempDatabase) {
            res.push("TEMPDATABASE '" + rec.tempDatabase + "'");
        }
        else if (rec.database) {
            res.push("TEMPDATABASE '" + rec.database + "'");
        }
        if (rec.database) {
            res.push("DEFAULTDATABASE '" + rec.database + "'");
        }
        if (rec.caseSensitive) {
            res.push("OBJECTNAMECASESENSITIVE 'TRUE'");
        }
        if (rec.enabled != undefined) {
            res.push("ENABLED '" + (rec.enabled ? "TRUE" : "FALSE") + "'");
        }
        if (rec.group) {
            res.push("DATASOURCE GROUP '" + rec.group + "'");
        }
        if (rec.urlProperties) {
            res.push("CONNECTION_PROPERTIES '" + rec.urlProperties + "'");
        }

        if (rec.connection_string) {
            res.push("CONNECTION_STRING '" + rec.connection_string + "'");
        }

        let r = res.join(",");
        if (rec.extraOptions) {
            r = r + "," + rec.extraOptions;
        }
        return r.split(",");
    }

    private makeUpdateOptionsSQL(properties: any): any {
        let options: any = {};
        for (let prop in properties) {
            let v1 = (this as any)[prop];
            let v2 = properties[prop];
            if (v1 != v2) {
                options[prop] = properties[prop];
            }
        }
        return this.generateOptionsSQL(options, true);
    }




    private makeOptionsSql() {
        return this.generateOptionsSQL(this);
    }
}

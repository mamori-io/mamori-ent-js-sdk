

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
import { prepareFilter, addFilterToDxGridOptions } from './utils';


export class DBCredential implements ISerializable {

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): DBCredential {
        let result = new DBCredential();
        result.fromJSON(ds);
        return result;
    }

    public static list(api: MamoriService, from: number, to: number, filter?: any): Promise<any> {
        let filters = prepareFilter(filter);
        let payload = filter ? { skip: from, take: to, filter: filters } : { skip: from, take: to };
        return api.callAPI("PUT", "/v1/search/granted_datasource_access", payload).then(result => {
            return result.data.map((item: any) => {
                let s = DBCredential.build(item);
                return s;
            })
        });
    }

    public static listFor(api: MamoriService, from: number, to: number, datasource: any, username: any): Promise<any> {
        let filter = [["grantee", "equals", '@']];
        if (datasource) {
            filter.push(["systemname", "equals", datasource]);
        }
        if (username) {
            filter.push(["accessname", "equals", username]);
        }
        return this.list(api, from, to, filter);
    }


    public static getByName(api: MamoriService, datasource: any, username: any): Promise<any> {
        return DBCredential.listFor(api, 0, 5, datasource, username).then(data => {
            if (data.length > 0) {
                return data[0];
            }
            return null;
        });
    }

    public static deleteByName(api: MamoriService, datasource: any, username: any): Promise<any> {
        return new Promise((resolve, reject) => {
            DBCredential.getByName(api, datasource, username).then(res => {
                if (res) {
                    (res as DBCredential).delete(api).then(r => {
                        resolve({ error: false, item: res });
                    });
                } else {
                    resolve({ error: false, item: null, message: "resource not found" });
                }
            }).catch(e => {
                reject({ error: true, exception: e });
            })
        });
    }

    fromJSON(record: any) {
        for (let prop in this) {
            if (record.hasOwnProperty(prop)) {
                this[prop] = record[prop];
            }
        }
        return this;
    }

    toJSON(): any {
        let res: any = {};
        for (let prop in this) {
            res[prop] = this[prop];
        }
        return res;
    }

    get datasource(): string {
        return this.systemname;
    }

    set datasource(value: string) {
        this.systemname = value;
    }

    systemname: string;
    accessname: string;
    valid_from: any;
    valid_until: any;
    credential_reset_days: string;
    next_credential_reset: any;
    is_managed: any;
    request_via: any;
    auth_id: any;
    auth_status: any;
    uid: any;
    granteetype: any;
    accesstype: any;

    /**
     * @param name  Unique Key name
     */
    public constructor() {
        this.systemname = "";
        this.accessname = "";
        this.valid_from = null;
        this.valid_until = null
        this.credential_reset_days = '';
        this.next_credential_reset = null;
        this.is_managed = false;
        this.request_via = null;
        this.auth_id = null;
        this.auth_status = null;
        this.uid = null;
        this.granteetype = null;
        this.accesstype = null;
    }

    public withDatasource(value: string): DBCredential {
        this.systemname = value;
        return this;
    }

    public withUsername(value: string): DBCredential {
        this.accessname = value;
        return this;
    }

    public withResetDays(value: any): DBCredential {
        this.credential_reset_days = value;
        return this;
    }


    /**
     * @param api 
     * @returns 
     */
    public create(api: MamoriService, password: string): Promise<any> {
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent('@') + "/datasource_authorization",
            { datasource: this.systemname, username: this.accessname, password: password, reset_days: this.credential_reset_days });
    }

    public delete(api: MamoriService): Promise<any> {
        return api.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent('"@"') + "/datasource_authorization", { datasource: this.systemname, username: this.accessname });
    }


}


/*


GRANT
dm.grant_to(this.grantee, ["CREDENTIAL USAGE"], '"' + this.username + "@" + this.selectedDatasource + '"')

DELETE
else if(row.accesstype == "datasource") {
          return dm.revoke(row.grantee, { grantables: ['CREDENTIAL USAGE'], object_name: row.systemname}).then(() => this.refreshGrid());
      } else if (row.accesstype == "role") {
              return dm.revoke_from(row.grantee, [row.accessname])


LIST
public get_datasource_credentials(datasource: string) {
        return this.callAPI("GET", "/v1/credentials/" + datasource);
    }

     return this.callAPI("PUT", "/v1/search/granted_datasource_access", options);
          return dm.search_granted_datasource_access(options).then((data) => {
            this.$emit("total", data.data.count);
            data.data = data.data.map((item) => {
              item.auth_valid_from = dm.convert_server_date(
                item.auth_valid_from
              );
              item.auth_valid_until = dm.convert_server_date(
                item.auth_valid_until
              );

              item.permission_valid_from = dm.convert_server_date(
                item.permission_valid_from
              );
              item.permission_valid_until = dm.convert_server_date(
                item.permission_valid_until
              );

              item.role_grant_valid_from = dm.convert_server_date(
                item.role_grant_valid_from
              );
              item.role_grant_valid_until = dm.convert_server_date(
                item.role_grant_valid_until
              );

              return item;
            });
            return data;
          });
*/


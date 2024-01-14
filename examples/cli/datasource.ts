process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from '../src/api';
import { io_policy, io_alertchannel, io_role, io_permission, io_user } from "../src/api";


const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';
const oracleDS = process.env.MAMORI_ORACLE_DS;

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

let dbtest = dbPassword ? test : test.skip;
let oracleDSTest = oracleDS ? test : test.skip;

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

describe("datasource tests", () => {

    let api: MamoriService;
    let grantee = "example_apiuser._datasource" ;
    let granteepw = "J{J'vpKs!$n3213W6(6A,4_vdQ'}D"
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);

    await io_utils.ignoreError(api.delete_user(grantee));
    await api.create_user({
        username: grantee,
        password: granteepw,
        fullname: grantee,
        identified_by: "password",
        email: "test@test.test"
    }).catch(e => {
        fail(io_utils.handleAPIException(e));
    })

    async function example() {
        await api.delete_user(grantee);
        await api.logout();
    }
    dbtest('datasource 001', async () => {
        let dsName = "test_local_pg" + testbatch;
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
    
        ds.ofType("POSTGRESQL", 'postgres')
            .at(dbHost, Number(dbPort))
            .withCredentials('postgres', dbPassword)
            .withDatabase('mamorisys')
            .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
        let res = await io_utils.noThrow(ds.create(api));
        expect(res.error).toBe(false);
        //Grant a credential to a user
        let ccred = await io_utils.noThrow(ds.addCredential(api, grantee, 'postgres', dbPassword));
        expect(res.error).toBe(false);
        //Delete a credential to a user
        let dcred = await io_utils.noThrow(ds.removeCredential(api, grantee));
        expect(res.error).toBe(false);
        //Delete the data source
        let resDel = await io_utils.noThrow(ds.delete(api));
        expect(resDel.error).toBe(false);
    });


});

	 	
    
console.log("**** %o",x);
	  api.logout();
	  

example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

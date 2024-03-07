process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from '../src/api';
import { io_datasource,io_db_credential,io_role,io_permission } from "../src/api";

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {
	let api = new MamoriService(mamoriUrl);
	console.info("Connecting...");
	let login = await api.login(mamoriUser, mamoriPwd);
	console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);
	  	
function createDS(name:string){
	let ds = new io_datasource.Datasource(name);
	let targetHost = dbHost;
	let targePort = dbPort;
	let targetDBPassword = "SOMEPASSW0RD";
	ds.ofType("POSTGRESQL", 'postgres')
			.at(targetHost, Number(targePort))
			.withCredentials('postgres', targetDBPassword)
			.withDatabase('mamorisys')
			.withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
			return ds;
		}

	//A credential is a login to a database
	//A credential is granted to a user or role (they are known as the grantee)
	//////////////////
	//CONFIGURE DATASOURCE
	let dbName = "example_db_source";
	let ds = createDS(dbName);
	await io_utils.noThrow(ds.create(api));
	//CREATE ROLE TO BE GRANTEE GRANTEE
	let grantee = "example_role";   
	let role = new io_role.Role(grantee);
	await io_utils.noThrow(role.create(api));
	///////////////////
	//CONFIGURE OBJECT
	let name = "postgres@"+dbName;
    let cred = new io_db_credential.DBCredential().withDatasource(dbName).withUsername("postgres");
    ////////////
	//CREATE IT
	await io_utils.noThrow(cred.create(api, dbName));
	console.info("creating db credential...%s",dbPassword);
	////////////
	//READ IT
	await io_utils.noThrow(io_db_credential.DBCredential.getByName(api, dbName, "postgres", "@"));
	console.info("reading db credential...%s",name);
	//GRANT IT
	let credPermission = new io_permission.CredentialPermission();
    credPermission.withDatasource(dbName).withLoginName("postgres").grantee(grantee);
    await io_utils.noThrow(credPermission.grant(api));
	////////////
	//DELETE IT
	await io_utils.noThrow(io_db_credential.DBCredential.deleteByName(api, dbName, "postgres", "@"));
	console.info("deleting db credential...%s",name);	  	
	///////////////////
	//DELETE DATASOURCE
	await io_utils.ignoreError(ds.delete(api));
	console.info("deleting datasource ...%s",dbName);
	api.logout();		
}

example()
  .catch(e => console.error("ERROR: ", e))
  .finally(() => process.exit(0));

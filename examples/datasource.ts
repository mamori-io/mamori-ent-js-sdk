process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { lchmodSync } from 'fs';
//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { } from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from 'mamori-ent-js-sdk';
import { io_datasource } from "mamori-ent-js-sdk";

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
  
//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {
	let api = new MamoriService(mamoriUrl);
	console.info("Connecting...");
	let login = await api.login(mamoriUser, mamoriPwd);
	console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);	  	
	///////////////////
	//CONFIGURE OBJECT
	let name = "exampledatasource";
    let ds = new io_datasource.Datasource(name);
    let targetHost = "192.45.54.27";
	let targePort = "5432";
	let targetDBPassword = "SOMEPASSW0RD";
	ds.ofType("POSTGRESQL", 'postgres')
        .at(targetHost, Number(targePort))
        .withCredentials('postgres', targetDBPassword)
        .withDatabase('mamorisys')
        .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
    let res = await io_utils.noThrow(ds.create(api));
    ////////////
	//CREATE IT
	console.info("creating datasource...%s",name);
	await io_utils.ignoreError(ds.delete(api));
	////////////
	//READ IT	
	let results = (await io_utils.noThrow(io_datasource.Datasource.read(api,name)));		
	console.info("reading  datasource..%s",results);
	////////////
	//DELETE IT
	await io_utils.ignoreError(ds.delete(api));
	console.info("deleting datasource..%o",name);  
	api.logout();
}

example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));
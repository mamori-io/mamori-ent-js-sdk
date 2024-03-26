import { MamoriService } from '../../api';
import { io_https, io_datasource, io_utils, io_role, io_db_credential } from '../../api';
import { setPassthroughPermissions, createNewPassthroughSession, createPGDatabaseUser, dropPGDatabaseUser } from '../../__utility__/ds';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';
const oracleDS = process.env.MAMORI_ORACLE_DS;

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

let dbtest = dbPassword ? test : test.skip;
let oracleDSTest = oracleDS ? test : test.skip;

describe("datasource tests", () => {

    let api: MamoriService;
    let grantee = "test_apiuser._datasource" + testbatch;
    let granteepw = "J{J'vpKs!$n3213W6(6A,4_vdQ'}D"


    beforeAll(async () => {
        //console.log("login %s %s", host, username);
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
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await api.logout();
    });


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
        //
        let results = (await io_utils.noThrow(io_datasource.Datasource.read(api,dsName)));		
        //console.info("reading  datasource..%o",results);
        expect(results.status).not.toBeNull();

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

    dbtest('datasource 002 - postgres password policy', async () => {
        //Create DS
        let dsHost = dbHost;
        let dsport = dbPort;
        let dsUser = "postgres";
        let dsDBPW = dbPassword;
        let dsDB = "mamorisys";

        let dsName = "test_002_local_pg" + testbatch;
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("POSTGRESQL", 'postgres')
            .at(dsHost, dsport)
            .withCredentials(dsUser, dsDBPW)
            .withDatabase(dsDB);
        let res = await io_utils.noThrow(ds.create(api));
        expect(res.error).toBe(false);
        //CREATE THE USER
        let uName = 'T002' + grantee;
        await io_utils.ignoreError(api.delete_user(uName));
        let r1 = await io_utils.noThrow(api.create_user({
            username: uName,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }));
        expect(r1.error).toBe(false);
        //ADD CREDENTIAL
        let ccred = await io_utils.noThrow(ds.addCredential(api, uName, dsUser, dsDBPW));
        expect(ccred.error).toBe(false);
        //SET PERMISSIONS
        await setPassthroughPermissions(api, uName, dsName);
        let apiU = await createNewPassthroughSession(host, uName, granteepw, dsName);
        try {
            //MAKE NEW DB LOGIN USER 2
            let pw = "!testPW";
            let loginU1 = ("testu1002" + testbatch).toLowerCase();
            let loginU2 = ("testu2002" + testbatch).toLowerCase();
            await createPGDatabaseUser(apiU, loginU1, pw, dsDB);
            await createPGDatabaseUser(apiU, loginU2, pw, dsDB);
            //CHECK U1 Password no longer works with credential validate
            let r7 = await io_utils.noThrow(ds.validateCredential(api, grantee, loginU1, pw));
            expect(r7).toBe("Authorization valid");
            //CHECK U1 Password no longer works with credential validate
            let r8 = await io_utils.noThrow(ds.validateCredential(api, grantee, loginU2, pw));
            expect(r8).toBe("Authorization valid");

            //MAKE NEW ROLE & GRANT TO GRANTEE
            let rName = dsName + "_002_role" + testbatch;
            let dsRole = new io_role.Role(rName);
            await io_utils.ignoreError(dsRole.delete(api));
            let r4 = await io_utils.noThrow(dsRole.create(api));
            expect(r4.errors).toBeUndefined();
            let r5 = await io_utils.noThrow(dsRole.grantTo(api, uName, false));
            expect(r5.errors).toBe(false);
            //MAKE NEW DATA SOURCE using USER1
            let ds2 = new io_datasource.Datasource("A" + dsName);
            await io_utils.ignoreError(ds2.delete(api));
            ds2.ofType("POSTGRESQL", 'postgres')
                .at(dsHost, dsport)
                .withCredentials(loginU1, pw)
                .withDatabase(dsDB)
                .withPasswordPolicy("30", rName);
            let r6 = await io_utils.noThrow(ds2.create(api));
            expect(r6.errors).toBeUndefined();
            let r9 = await io_utils.noThrow(ds2.validateCredential(api, grantee, loginU1, pw));
            //console.log(r9);
            expect(r9.errors).toBeDefined();
            let r10 = await io_utils.noThrow(ds2.addCredentialWithManagedPassword(api, grantee, loginU2, pw, "15"));
            expect(r10.errors).toBeUndefined();
            let r11 = await io_utils.noThrow(ds2.validateCredential(api, grantee, loginU2, pw));
            expect(r11.errors).toBeDefined();

            await io_utils.ignoreError(dsRole.delete(api));
            await io_utils.ignoreError(ds2.delete(api));
            await dropPGDatabaseUser(apiU, loginU1, dsDB);
            await dropPGDatabaseUser(apiU, loginU2, dsDB);
        } finally {
            //CLEAN UP
            await io_utils.ignoreError(apiU.logout());
            await io_utils.ignoreError(ds.delete(api));
            await io_utils.ignoreError(api.delete_user(uName));
        }
    });

    dbtest('datasource 003 - delete cred on disabled ds', async () => {
        //Create DS
        let dsHost = dbHost;
        let dsport = dbPort;
        let dsUser = "postgres";
        let dsDBPW = dbPassword;
        let dsDB = "mamorisys";

        let dsName = "test_003_local_pg" + testbatch;
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("POSTGRESQL", 'postgres')
            .at(dsHost, dsport)
            .withCredentials(dsUser, dsDBPW)
            .withDatabase(dsDB);
        let res = await io_utils.noThrow(ds.create(api));
        expect(res.errors).toBeUndefined();

        //CREATE THE USER
        let uName = 'T003' + grantee;
        await io_utils.ignoreError(api.delete_user(uName));
        let r1 = await io_utils.noThrow(api.create_user({
            username: uName,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }));
        expect(r1.error).toBe(false);
        //ADD CREDENTIAL
        let ccred = await io_utils.noThrow(ds.addCredential(api, uName, dsUser, dsDBPW));
        expect(ccred.error).toBe(false);
        //DISABLE DS
        let r = await io_utils.noThrow(ds.update(api, { enabled: false }));
        expect(r.errors).toBeUndefined();
        let r2 = await io_utils.noThrow(ds.removeCredential(api, uName));
        expect(r2.errors).toBeUndefined();
        //CLEAN UP
        await io_utils.ignoreError(ds.delete(api));
        await io_utils.ignoreError(api.delete_user(uName));
    });

    dbtest('datasource 004 - managed pw without role', async () => {
        //Create DS
        let dsHost = dbHost;
        let dsport = dbPort;
        let dsUser = "postgres";
        let dsDBPW = dbPassword;
        let dsDB = "mamorisys";

        let dsName = "test_004_local_pg" + testbatch;
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("POSTGRESQL", 'postgres')
            .at(dsHost, dsport)
            .withCredentials(dsUser, dsDBPW)
            .withDatabase(dsDB);
        let res = await io_utils.noThrow(ds.create(api));
        expect(res.error).toBe(false);
        //CREATE THE USER
        let uName = 'T004' + grantee;
        await io_utils.ignoreError(api.delete_user(uName));
        let r1 = await io_utils.noThrow(api.create_user({
            username: uName,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }));
        expect(r1.error).toBe(false);
        //ADD CREDENTIAL
        let ccred = await io_utils.noThrow(ds.addCredential(api, uName, dsUser, dsDBPW));
        expect(ccred.error).toBe(false);
        //SET PERMISSIONS
        await setPassthroughPermissions(api, uName, dsName);
        let apiU = await createNewPassthroughSession(host, uName, granteepw, dsName);
        try {
            //MAKE NEW DB LOGIN USER 2
            let pw = "!testPW";
            let loginU1 = ("testu1004" + testbatch).toLowerCase();
            let loginU2 = ("testu2004" + testbatch).toLowerCase();
            await createPGDatabaseUser(apiU, loginU1, pw, dsDB);
            await createPGDatabaseUser(apiU, loginU2, pw, dsDB);
            //CHECK U1 Password no longer works with credential validate
            let r7 = await io_utils.noThrow(ds.validateCredential(api, grantee, loginU1, pw));
            expect(r7).toBe("Authorization valid");
            //CHECK U1 Password no longer works with credential validate
            let r8 = await io_utils.noThrow(ds.validateCredential(api, grantee, loginU2, pw));
            expect(r8).toBe("Authorization valid");

            //MAKE NEW DATA SOURCE using USER1
            let ds2 = new io_datasource.Datasource("A" + dsName);
            await io_utils.ignoreError(ds2.delete(api));
            ds2.ofType("POSTGRESQL", 'postgres')
                .at(dsHost, dsport)
                .withCredentials(loginU1, pw)
                .withDatabase(dsDB)
                .withPasswordPolicy("30", "");
            let r6 = await io_utils.noThrow(ds2.create(api));
            expect(r6.errors).toBeUndefined();
            let r9 = await io_utils.noThrow(ds2.validateCredential(api, grantee, loginU1, pw));
            //console.log(r9);
            expect(r9.errors).toBeDefined();
            let r10 = await io_utils.noThrow(ds2.addCredentialWithManagedPassword(api, grantee, loginU2, pw, "15"));
            expect(r10.errors).toBeUndefined();
            let r11 = await io_utils.noThrow(ds2.validateCredential(api, grantee, loginU2, pw));
            expect(r11.errors).toBeDefined();

            await io_utils.ignoreError(ds2.delete(api));
            await dropPGDatabaseUser(apiU, loginU1, dsDB);
            await dropPGDatabaseUser(apiU, loginU2, dsDB);
        } finally {
            //CLEAN UP
            await io_utils.ignoreError(apiU.logout());
            await io_utils.ignoreError(ds.delete(api));
            await io_utils.ignoreError(api.delete_user(uName));
        }
    });

    oracleDSTest('datasource 005 - ORA create DS alter 01', async () => {

        //
        let dsDef = JSON.parse(oracleDS!);

        let dsName = "test_005_ORA_" + testbatch;
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("ORACLE", dsDef.driver)
            .at(dsDef.host, dsDef.port)
            .withCredentials(dsDef.uname, dsDef.pw)
            .withDatabase(dsDef.sid);

        await io_utils.ignoreError(ds.delete(api))

        let res = await io_utils.noThrow(ds.create(api));
        expect(res.error).toBe(false);
        //
        let r2 = await io_utils.noThrow(io_db_credential.DBCredential.getByName(api, ds.name, dsDef.uname, "@"));
        expect(r2.auth_id).toBeDefined();
        //
        let cs = "jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL =TCP)(HOST=:HOST)(PORT=:PORT))(CONNECT_DATA=(SERVICE_NAME=:SID)))"
            .replace(":HOST", dsDef.host)
            .replace(":PORT", dsDef.port)
            .replace(":SID", dsDef.sid);
        let opt = { connection_string: cs, host: '', port: '' };
        let r = await io_utils.noThrow(ds.update(api, opt));
	if(r.errors) {
	    throw r.response.data.message;
	}
        expect(r.error).toBe(false);

        let r5 = await io_utils.noThrow(ds.get(api));
        expect(r5.options).toBeDefined();
        let o = r5.options.filter((x: any) => x.optionnameddl == 'CONNECTION_STRING');
        expect(o[0].currentvalue).toBe(cs);

        await io_utils.ignoreError(ds.delete(api));
    });

    oracleDSTest('datasource 006- ORA create DS alter 02', async () => {

        //
        let dsDef = JSON.parse(oracleDS!);
        let dsName = "test_006_ORA_" + testbatch;
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        //
        let cs = "jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL =TCP)(HOST=:HOST)(PORT=:PORT))(CONNECT_DATA=(SERVICE_NAME=:SID)))"
            .replace(":HOST", dsDef.host)
            .replace(":PORT", dsDef.port)
            .replace(":SID", dsDef.sid);

        //
        ds.ofType("ORACLE", dsDef.driver)
            .withConnectionString(cs)
            .withCredentials(dsDef.uname, dsDef.pw);

        await io_utils.ignoreError(ds.delete(api))
        let res = await io_utils.noThrow(ds.create(api));
        expect(res.error).toBe(false);
        let opt = { host: dsDef.host, port: dsDef.port, database: dsDef.sid, driver: dsDef.driver };
        //ds.at(dsDef.host, dsDef.port)
        //this.host = dsDef.host;
        let r = await io_utils.noThrow(ds.update(api, opt));
	if(r.errors) {
	    throw r.response.data.message;
	}
        expect(r.error).toBe(false);
        //["DRIVER 'oracle11204'", "HOST 'sandbox.mamori.io'", "PORT '1521'", "DEFAULTDATABASE 'oracle193'", "TEMPDATABASE 'oracle193'"]
        await io_utils.ignoreError(ds.delete(api))
    });

    oracleDSTest('datasource 007 - ORA create DS alter 03', async () => {
        //
        let dsDef = JSON.parse(oracleDS!);

        let dsName = "test_007_ORA_" + testbatch;
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("ORACLE", dsDef.driver)
            .at(dsDef.host, dsDef.port)
            .withCredentials(dsDef.uname.toLowerCase(), dsDef.pw)
            .withDatabase(dsDef.sid);

        await io_utils.ignoreError(ds.delete(api))

        let res = await io_utils.noThrow(ds.create(api));
        expect(res.error).toBe(false);
        let r2 = await io_utils.noThrow(io_db_credential.DBCredential.getByName(api, ds.name, dsDef.uname.toLowerCase(), "@"));
        expect(r2.auth_id).toBeDefined();

        let opt = { user: dsDef.uname.toUpperCase(), password: dsDef.password };
        let r = await io_utils.noThrow(ds.update(api, opt));
	if(r.errors) {
	    throw r.response.data.message;
	}
        expect(r.error).toBe(false);
        let r3 = await io_utils.noThrow(io_db_credential.DBCredential.listFor(api, 0, 100, dsName, dsDef.uname, "@"));
        expect(r3.length).toBe(1);
        //
        await io_utils.ignoreError(ds.delete(api));
    });



});

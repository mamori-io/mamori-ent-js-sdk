process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

//import { MamoriService,io_https,io_utils } from 'mamori-ent-js-sdk';
//import { AlertChannel, HTTP_OPERATION} from 'mamori-ent-js-sdk';
import { MamoriService,io_https, io_utils } from '../src/api';
import { io_datasource,io_role, io_db_credential } from "../src/api";
import { io_alertchannel } from "../src/api";
import { setPassthroughPermissions, createNewPassthroughSession, createPGDatabaseUser, dropPGDatabaseUser } from '../../__utility__/ds';



const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME || '';
const mamoriPwd = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';
const oracleDS = process.env.MAMORI_ORACLE_DS;
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

//let mamoriUrl = "https://localhost/" ;
//let mamoriUser = "alice" ;
//let mamoriPwd  = "mirror" ;

async function example() {

    console.info("Connecting...");
    let login = await api.login(mamoriUser, mamoriPwd);
    console.info("Login successful for: ", login.fullname, ", session: ", login.session_id);

    let api: MamoriService;
    let grantee = "test_apiuser._datasource" + testbatch;
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

        await api.delete_user(grantee);
        await api.logout();

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


  

    console.log("**** %o",r);
    api.logout();

}

example()
  .catch(e => console.error("ERROR: ", e))
    .finally(() => process.exit(0));

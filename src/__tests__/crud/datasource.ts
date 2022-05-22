import { MamoriService } from '../../api';
import * as https from 'https';
import { Datasource } from '../../datasource';
import { handleAPIException, noThrow, ignoreError } from '../../utils';
import { DatasourcePermission, DB_PERMISSION } from '../../permission';
import { ServerSession } from '../../server-session';

import { setPassthroughPermissions, createNewPassthroughSession, createPGDatabaseUser, dropPGDatabaseUser } from '../subroutines/ds';
import { Role } from '../../role';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

if (dbPassword) {
    describe("datasource tests", () => {

        let api: MamoriService;
        let grantee = "test_apiuser._datasource" + testbatch;
        let granteepw = "J{J'vpKs!$n3213W6(6A,4_vdQ'}D"


        beforeAll(async () => {
            console.log("login %s %s", host, username);
            api = new MamoriService(host, INSECURE);
            await api.login(username, password);

            await ignoreError(api.delete_user(grantee));
            await api.create_user({
                username: grantee,
                password: granteepw,
                fullname: grantee,
                identified_by: "password",
                email: "test@test.test"
            }).catch(e => {
                fail(handleAPIException(e));
            })
        });

        afterAll(async () => {
            await api.delete_user(grantee);
            await api.logout();
        });


        test('datasource 001', async done => {
            let dsName = "test_local_pg" + testbatch;
            let ds = new Datasource(dsName);
            await ignoreError(ds.delete(api));

            ds.ofType("POSTGRESQL", 'postgres')
                .at("localhost", 54321)
                .withCredentials('postgres', dbPassword)
                .withDatabase('mamorisys')
                .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
            let res = await noThrow(ds.create(api));
            expect(res.error).toBe(false);
            //Grant a credential to a user
            let ccred = await noThrow(ds.addCredential(api, grantee, 'postgres', dbPassword));
            expect(res.error).toBe(false);
            //Delete a credential to a user
            let dcred = await noThrow(ds.removeCredential(api, grantee));
            expect(res.error).toBe(false);
            //Delete the data source
            let resDel = await noThrow(ds.delete(api));
            expect(resDel.error).toBe(false);

            done();
        });



        test('datasource 002 - password policy', async done => {

            //Create DS
            let dsName = "test_002_local_pg" + testbatch;
            let ds = new Datasource(dsName);
            await ignoreError(ds.delete(api));
            ds.ofType("POSTGRESQL", 'postgres')
                .at("localhost", 54321)
                .withCredentials('postgres', dbPassword)
                .withDatabase('mamorisys')
                .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
            let res = await noThrow(ds.create(api));
            expect(res.error).toBe(false);
            //CREATE THE USER
            let uName = 'T002' + grantee;
            await ignoreError(api.delete_user(uName));
            let r1 = await noThrow(api.create_user({
                username: uName,
                password: granteepw,
                fullname: grantee,
                identified_by: "password",
                email: "test@test.test"
            }));
            expect(r1.error).toBe(false);
            //ADD CREDENTIAL
            let ccred = await noThrow(ds.addCredential(api, uName, 'postgres', dbPassword));
            expect(ccred.error).toBe(false);
            //SET PERMISSIONS
            await setPassthroughPermissions(api, uName, dsName);
            let apiU = await createNewPassthroughSession(host, uName, granteepw, dsName);
            try {
                //MAKE NEW DB LOGIN USER 2
                let pw = "!testPW";
                let loginU1 = ("testu1002" + testbatch).toLowerCase();
                let loginU2 = ("testu2002" + testbatch).toLowerCase();
                await createPGDatabaseUser(apiU, loginU1, pw, "mamorisys");
                await createPGDatabaseUser(apiU, loginU2, pw, "mamorisys");
                //CHECK U1 Password no longer works with credential validate
                let r7 = await noThrow(ds.validateCredential(api, grantee, loginU1, pw));
                expect(r7).toBe("Authorization valid");
                //CHECK U1 Password no longer works with credential validate
                let r8 = await noThrow(ds.validateCredential(api, grantee, loginU2, pw));
                expect(r8).toBe("Authorization valid");

                //MAKE NEW ROLE & GRANT TO GRANTEE
                let rName = dsName + "_002_role" + testbatch;
                let dsRole = new Role(rName);
                await ignoreError(dsRole.delete(api));
                let r4 = await noThrow(dsRole.create(api));
                expect(r4.errors).toBeUndefined();
                let r5 = await noThrow(dsRole.grantTo(api, uName, false));
                expect(r5.errors).toBe(false);
                //MAKE NEW DATA SOURCE using USER1
                let ds2 = new Datasource("A" + dsName);
                await ignoreError(ds2.delete(api));
                ds2.ofType("POSTGRESQL", 'postgres')
                    .at("localhost", 54321)
                    .withCredentials(loginU1, pw)
                    .withDatabase('mamorisys')
                    .withPasswordPolicy("30", rName)
                    .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true')
                    ;
                let r6 = await noThrow(ds2.create(api));
                expect(r6.errors).toBeUndefined();
                let r9 = await noThrow(ds2.validateCredential(api, grantee, loginU1, pw));
                expect(r9.errors).toBeDefined();
                let r10 = await noThrow(ds2.addCredentialWithManagedPassword(api, grantee, loginU2, pw, "15"));
                expect(r10.errors).toBeUndefined();
                let r11 = await noThrow(ds2.validateCredential(api, grantee, loginU2, pw));
                expect(r11.errors).toBeDefined();

                await ignoreError(dsRole.delete(api));
                await ignoreError(ds2.delete(api));
                await dropPGDatabaseUser(apiU, loginU1, "mamorisys");
                await dropPGDatabaseUser(apiU, loginU2, "mamorisys");
            } finally {
                //CLEAN UP
                await ignoreError(apiU.logout());
                await ignoreError(ds.delete(api));
                await ignoreError(api.delete_user(uName));
            }
            done();
        });




    });
}

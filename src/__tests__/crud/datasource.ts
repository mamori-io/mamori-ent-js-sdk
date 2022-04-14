import { MamoriService } from '../../api';
import * as https from 'https';
import { Datasource } from '../../datasource';
import { handleAPIException, noThrow, ignoreError } from '../../utils';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

if (dbPassword) {
    describe("datasource tests", () => {

        let api: MamoriService;
        let grantee = "test_apiuser_datasource" + testbatch;
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


        test('local datasource 01', async done => {
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

    });
}

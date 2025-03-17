import { MamoriService } from '../../api';
import { io_https, io_utils, io_datasource, io_db_credential, io_permission } from '../../api';
import { ignoreError } from '../../utils';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';
const dbUsername = process.env.MAMORI_DB_USERNAME || 'postgres';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

let dbtest = dbPassword ? test : test.skip;

describe("datasource permission tests", () => {

    let api: MamoriService;
    let grantee = "test_apiuser_roles_" + testbatch;
    let granteepw = "J{J'vpKsn\/a@C+W6(6A,4_vdQ'}D"
    let dsName = "test_role_perm_local_pg" + testbatch;

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
        });

        // make sure the ds does not already exist
        await io_utils.noThrow((new io_datasource.Datasource(dsName)).delete(api));

        // create the ds we need for this test
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("POSTGRESQL", 'postgres')
            .at(dbHost, Number(dbPort))
            .withCredentials(dbUsername, dbPassword)
            .withDatabase('mamorisys')
            .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
        let res = await io_utils.noThrow(ds.create(api));
        if (res.error !== false) {
            expect(res).toBe({});
        }
    });

    afterAll(async () => {
        await api.logout();
    });

    dbtest('grant mixed case role grant - #9306', async () => {
        await io_utils.noThrow(io_db_credential.DBCredential.deleteByName(api, dsName, dbUsername, "@"));
        let c = new io_db_credential.DBCredential().withDatasource(dsName).withUsername(dbUsername);
        let cred = io_db_credential.DBCredential.build(c.toJSON());
        let r = await io_utils.noThrow(cred.create(api, dbPassword));

        expect(r).toSucceed();

        let name = "admin-api-test_role" + testbatch;

        await ignoreError(api.select('drop role "' + name + '" cascade'));
        expect(await api.select('create role "' + name + '"')).toSucceed();

        await api.select('grant MASKED PASSTHROUGH to "' + name + '"');

        let name2 = "admin-api-test_role2" + testbatch;
        await ignoreError(api.select('drop role "' + name2 + '" cascade'));
        expect(await api.select('create role "' + name2 + '"')).toSucceed();

        await api.select('grant "' + name + '" to "' + name2.toUpperCase() + '"');
        await api.select('grant "' + name2.toUpperCase() + '"  to ' + grantee);

        // TODO: look into why api.select does return a QueryResponse. At the moment it appears not to in this case
        let rows: any = await api.select("call check_permission('" + grantee + "', 'masked passthrough', null, null, null, null)");
        expect(rows.length).toBe(1);
        let row: any = rows[0];
        expect(row["has_permission"]).toBe('yes');
        expect(row["has_exact_permission"]).toBe('yes');

        let credPermission = new io_permission.CredentialPermission();
        credPermission.withDatasource(dsName).withLoginName(dbUsername).grantee(name);
        let rx2 = await io_utils.noThrow(credPermission.grant(api));
        expect(rx2).toSucceed();

        let dsAccess: any = await api.select("select systemname from mamori.mamorisys.security.granted_ds_access('" + grantee + "') x");

        expect(dsAccess.length).toBeGreaterThanOrEqual(1);

        let systemFound = false;
        for (let row of dsAccess) {
            if (row["systemname"] == dsName) {
                systemFound = true;
                break;
            }
        }
        expect(systemFound).toBeTruthy();

    });

});

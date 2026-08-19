import { MamoriService } from '../../api';
import { io_https, io_utils, io_role, io_datasource, io_serversession } from '../../api';
import { setPassthroughPermissions } from '../../__utility__/ds';
import { selectQuery, sleep } from '../../__utility__/test-helper';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbUsername = process.env.MAMORI_DB_USERNAME || 'postgres';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

let dbtest = dbPassword ? test : test.skip;

describe("grantee datasource credential access", () => {

    let api: MamoriService;
    let grantee = "test_apiuser_ds_cred_" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!3#$4#12_vdQ'}D";
    let dsName = "test_ds_cred_access_pg" + testbatch;
    let ds: io_datasource.Datasource;
    let cluster_nodes: any[] = [];

    beforeAll(async () => {
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

        let resp: any = await api.select("call cluster_nodes()");
        cluster_nodes = Array.isArray(resp) ? resp : [];

        ds = new io_datasource.Datasource(dsName);
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

        let ready = await waitForDatasource(dsName);
        expect(ready).not.toBeFalsy();

        // SELECT + MASKED PASSTHROUGH are granted to the user so each test
        // isolates credential inheritance as the variable under test.
        await setPassthroughPermissions(api, grantee, dsName);
    });

    afterAll(async () => {
        await io_utils.ignoreError(api.delete_user(grantee));
        await io_utils.ignoreError((new io_datasource.Datasource(dsName)).delete(api));
        await api.logout();
    });

    async function waitForDatasource(name: string) {
        let counter = 15;
        while (counter > 0) {
            let results = await io_utils.noThrow(io_datasource.Datasource.read(api, name));
            if (results && results.available === "true") {
                if (cluster_nodes.length <= 1 || Number(results.available_count) === cluster_nodes.length) {
                    return results;
                }
            }
            await sleep(1000);
            counter--;
        }
        return null;
    }

    async function hasGrantedDsAccess(user: string): Promise<boolean> {
        let dsAccess: any = await api.select(
            "select systemname from mamori.mamorisys.security.granted_ds_access('" + user + "') x");
        if (!Array.isArray(dsAccess)) {
            return false;
        }
        return dsAccess.some((row: any) => row.systemname === dsName);
    }

    async function withUserSession(fn: (apiUser: MamoriService) => Promise<void>) {
        let apiUser = new MamoriService(host, INSECURE);
        try {
            await apiUser.login(grantee, granteepw);
            await fn(apiUser);
        } finally {
            await io_utils.ignoreError(apiUser.logout());
        }
    }

    async function assertCanConnectAndSelect() {
        expect(await hasGrantedDsAccess(grantee)).toBe(true);
        await withUserSession(async (apiUser) => {
            let pt = await io_utils.noThrow(io_serversession.ServerSession.setPassthrough(apiUser, dsName));
            expect(pt).toSucceed();
            let rows = await selectQuery(apiUser, "select current_user as username");
            expect(rows.errors).toBeUndefined();
            expect(rows.length).toBeGreaterThan(0);
            let connectedUser = String(rows[0].username || rows[0].USERNAME || '');
            expect(connectedUser.toLowerCase()).toBe(dbUsername.toLowerCase());
        });
    }

    async function assertCannotConnect() {
        expect(await hasGrantedDsAccess(grantee)).toBe(false);
        await withUserSession(async (apiUser) => {
            let pt = await io_utils.noThrow(io_serversession.ServerSession.setPassthrough(apiUser, dsName));
            expect(pt.errors).toBe(true);
        });
    }

    async function dropRole(roleid: string) {
        await io_utils.ignoreError(api.select('drop role "' + roleid + '" cascade'));
        await io_utils.ignoreError(new io_role.Role(roleid).delete(api));
    }

    dbtest('grantee 01 - direct credential access', async () => {
        await io_utils.ignoreError(ds.removeCredential(api, grantee));

        try {
            await assertCannotConnect();

            let granted = await io_utils.noThrow(ds.addCredential(api, grantee, dbUsername, dbPassword));
            expect(granted).toSucceed();

            await assertCanConnectAndSelect();

            let revoked = await io_utils.noThrow(ds.removeCredential(api, grantee));
            expect(revoked).toSucceed();

            await assertCannotConnect();
        } finally {
            await io_utils.ignoreError(ds.removeCredential(api, grantee));
        }
    });

    dbtest('grantee 02 - credential access via role', async () => {
        let roleName = "test_ds_cred_role1_" + testbatch;
        let role = new io_role.Role(roleName);
        await dropRole(roleName);

        try {
            let created = await io_utils.noThrow(role.create(api));
            expect(created).toSucceed();

            let cred = await io_utils.noThrow(ds.addCredential(api, role.roleid, dbUsername, dbPassword));
            expect(cred).toSucceed();

            await assertCannotConnect();

            let granted = await io_utils.noThrow(role.grantTo(api, grantee, false));
            expect(granted).toSucceed();

            await assertCanConnectAndSelect();

            let revoked = await io_utils.noThrow(role.revokeFrom(api, grantee));
            expect(revoked).toSucceed();

            await assertCannotConnect();
        } finally {
            await io_utils.ignoreError(role.revokeFrom(api, grantee));
            await io_utils.ignoreError(ds.removeCredential(api, role.roleid));
            await dropRole(roleName);
        }
    });

    dbtest('grantee 03 - credential access via nested role', async () => {
        let role1Name = "test_ds_cred_nrole1_" + testbatch;
        let role2Name = "test_ds_cred_nrole2_" + testbatch;
        let role1 = new io_role.Role(role1Name);
        let role2 = new io_role.Role(role2Name);
        await dropRole(role1Name);
        await dropRole(role2Name);

        try {
            expect(await io_utils.noThrow(role1.create(api))).toSucceed();
            expect(await io_utils.noThrow(role2.create(api))).toSucceed();

            // Role1 holds the credential; role1 -> role2 -> user
            let cred = await io_utils.noThrow(ds.addCredential(api, role1.roleid, dbUsername, dbPassword));
            expect(cred).toSucceed();
            expect(await io_utils.noThrow(role1.grantTo(api, role2.roleid, false))).toSucceed();

            await assertCannotConnect();

            expect(await io_utils.noThrow(role2.grantTo(api, grantee, false))).toSucceed();
            await assertCanConnectAndSelect();

            // Revoking the outer role from the user drops nested credential access
            expect(await io_utils.noThrow(role2.revokeFrom(api, grantee))).toSucceed();
            await assertCannotConnect();

            // Restore the outer grant, then revoke the inner role from the outer role
            expect(await io_utils.noThrow(role2.grantTo(api, grantee, false))).toSucceed();
            await assertCanConnectAndSelect();

            expect(await io_utils.noThrow(role1.revokeFrom(api, role2.roleid))).toSucceed();
            await assertCannotConnect();
        } finally {
            await io_utils.ignoreError(role2.revokeFrom(api, grantee));
            await io_utils.ignoreError(role1.revokeFrom(api, role2.roleid));
            await io_utils.ignoreError(ds.removeCredential(api, role1.roleid));
            await dropRole(role2Name);
            await dropRole(role1Name);
        }
    });

});

import { MamoriService } from '../../api';
import { io_https, io_utils, io_permission, io_requestable_resource, io_role, io_db_credential, io_datasource } from '../../api';
import * as helper from '../../__utility__/test-helper';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const dbPassword = process.env.MAMORI_DB_PASSWORD || '';
const dbHost = process.env.MAMORI_DB_HOST || 'localhost';
const dbPort = process.env.MAMORI_DB_PORT || '54321';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

let dbtest = dbPassword ? test : test.skip;

describe("DB Credential CRUD tests", () => {

    let api: MamoriService;
    let grantee = "test_apiuser_credential" + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!3#$4#12_vdQ'}D";
    let dsName = "test_ds_cred_local_pg" + testbatch;

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


        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("POSTGRESQL", 'postgres')
            .at(dbHost, Number(dbPort))
            .withCredentials('postgres', dbPassword)
            .withDatabase('mamorisys')
            .withConnectionProperties('allowEncodingChanges=true;defaultNchar=true');
        let res = await io_utils.noThrow(ds.create(api));
        if (res.error !== false) {
            expect(res).toBe({});
        }
    });

    afterAll(async () => {
        await api.delete_user(grantee);
        await io_utils.noThrow((new io_datasource.Datasource(dsName)).delete(api));
        await api.logout();
    });

    dbtest('credential create 01', async () => {

        await io_utils.noThrow(io_db_credential.DBCredential.deleteByName(api, dsName, "postgres", "@"));
        let c = new io_db_credential.DBCredential().withDatasource(dsName).withUsername("postgres");
        let cred = io_db_credential.DBCredential.build(c.toJSON());
        let r = await io_utils.noThrow(cred.create(api, dbPassword));
        expect(r.error).toBe(false);

        let r2 = await io_utils.noThrow(io_db_credential.DBCredential.getByName(api, dsName, "postgres", "@"));
        expect(r2.auth_id).toBeDefined();

        //GRANT THE CREDENTIAL TO A ROLE
        let rname = "role_" + dsName;
        let nrole = new io_role.Role(rname);
        await io_utils.ignoreError(nrole.delete(api));
        let rx = await io_utils.noThrow(nrole.create(api));
        expect(rx.error).toBe(false);
        let credPermission = new io_permission.CredentialPermission();
        credPermission.withDatasource(dsName).withLoginName("postgres").grantee(rname);
        let rx2 = await io_utils.noThrow(credPermission.grant(api));
        expect(rx2.errors).toBe(false);
        let rx3 = await io_utils.noThrow(credPermission.revoke(api));
        expect(rx3.errors).toBe(false);
        let res = await credPermission.list(api);
        expect(res.data.length).toBe(0);
        //Clean up role
        await io_utils.ignoreError(nrole.delete(api));

        //EXPORT
        let keyName = "test_cred_aes_key" + testbatch;
        await helper.EncryptionKey.setupAESEncryptionKey(api, keyName);
        let xx = await io_utils.noThrow(io_db_credential.DBCredential.exportByName(api, dsName, "postgres", "@", keyName));
        expect(xx.password).toBeDefined();

        await io_utils.noThrow(io_db_credential.DBCredential.deleteByName(api, dsName, "postgres", "@"))
        let xx1 = await io_utils.noThrow(xx.restore(api, keyName));
        expect(xx1.error).toBe(false);
        await helper.EncryptionKey.cleanupAESEncryptionKey(api, keyName);
        let x = await io_utils.noThrow(cred.delete(api));
        expect(x.error).toBe(false);
    });

    dbtest('db cred requestable', async () => {
        await io_utils.noThrow(io_db_credential.DBCredential.deleteByName(api, dsName, "postgres", "@"));
        let cred = new io_db_credential.DBCredential().withDatasource(dsName).withUsername("postgres");
        let r = await io_utils.noThrow(cred.create(api, dbPassword));
        expect(r.error).toBe(false);
        // ROLE
        let policyName = "test_req_cred_policy_" + testbatch;
        let endorsementRole = "test_role_for_" + policyName;
        let policy = await helper.Policy.setupResourcePolicy(api, endorsementRole, policyName);

        //REQUESTABLE
        let requestable = new io_requestable_resource.RequestableResource(io_requestable_resource.REQUEST_RESOURCE_TYPE.DATASOURCE)
            .withResource(dsName)
            .withLogin("postgress")
            .withGrantee(grantee)
            .withPolicy(policyName);
        //CLEAN UP
        await io_utils.noThrow(io_requestable_resource.RequestableResource.deleteByName(api,
            requestable.resource_type, grantee, dsName, policyName, requestable.resource_login));
        //CREATE
        let r1 = await io_utils.noThrow(requestable.create(api));
        expect(r1.error).toBe(false);
        //CONFIRM
        let l = await io_utils.noThrow(io_requestable_resource.RequestableResource.getByName(api,
            requestable.resource_type, grantee, dsName, policyName, requestable.resource_login));
        //CLEAN UP
        await io_utils.noThrow(io_requestable_resource.RequestableResource.deleteByName(api,
            requestable.resource_type, grantee, dsName, policyName, requestable.resource_login));

        await io_utils.noThrow(policy.delete(api));
        await io_utils.ignoreError(new io_role.Role(endorsementRole).delete(api));
        await io_utils.noThrow(io_db_credential.DBCredential.deleteByName(api, dsName, "postgres", "@"));
    });



});

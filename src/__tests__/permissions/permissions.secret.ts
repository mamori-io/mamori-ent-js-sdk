
import { MamoriService } from '../../api';
import { io_https, io_utils, io_permission, io_role, io_secret } from '../../api';
import { DBHelper } from '../../__utility__/test-helper';





const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("secret permission tests", () => {

    let api: MamoriService;
    let resource = "secret1-" + testbatch;
    let permType = "REVEAL SECRET";
    let grantee = "test_apiuser_secret." + testbatch;
    let granteepw = "J{J'vpKsn3213W6(6A,4_vdQ'}D"

    beforeAll(async () => {

        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //create the user

        await io_utils.ignoreError(api.delete_user(grantee));
        let result = await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(io_utils.handleAPIException(e));
        })

        let newS = new io_secret.Secret(io_secret.SECRET_PROTOCOL.RDP, resource)
            .withUsername("uname")
            .withHost("10.100.100.100")
            .withDescription("Udesc");
        await io_utils.ignoreError(newS.create(api));

        let newCapS = new io_secret.Secret(io_secret.SECRET_PROTOCOL.RDP, "CAPS" + resource)
            .withUsername("uname")
            .withHost("10.100.100.100")
            .withDescription("Udesc");
        await io_utils.ignoreError(newCapS.create(api));
    });

    afterAll(async () => {
        await io_utils.ignoreError(io_secret.Secret.deleteByName(api, "CAPS" + resource));
        await io_utils.ignoreError(io_secret.Secret.deleteByName(api, resource));
        await io_utils.ignoreError(api.delete_user(grantee));
        await api.logout();

    });

    test('grant 01', async () => {
        let obj = new io_permission.SecretPermission()
            .name(resource)
            .grantee(grantee);
        //make sure no exist
        await io_utils.ignoreError(obj.revoke(api));
        //check list
        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new io_permission.SecretPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        //grant
        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //check list
        res = await new io_permission.SecretPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        //try re-grant
        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);
        //revoke
        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //
        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
    });

    test('grant 02', async () => {

        let r1 = await new io_permission.SecretPermission()
            .name(resource)
            .grantee(grantee)
            .withValidFor(60, io_permission.TIME_UNIT.MINUTES)
            .grant(api);

        expect(r1.errors).toBe(false);

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee],
        ["key_name", io_utils.FILTER_OPERATION.EQUALS_STRING, resource],
        ["time_left", ">", 3500]
        ];

        let res = await new io_permission.SecretPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await io_utils.noThrow(new io_permission.SecretPermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new io_permission.SecretPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);


    });

    test('grant 03 - grant between', async () => {

        let dr = DBHelper.dateRange();
        let obj = await new io_permission.SecretPermission()
            .name(resource)
            .grantee(grantee)
            .withValidBetween(dr.fromDtz, dr.toDtz);

        await io_utils.ignoreError(obj.revoke(api));
        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee],
        ["key_name", io_utils.FILTER_OPERATION.EQUALS_STRING, resource],
        ["valid_from", "=", (new Date(dr.fromD)).toISOString()],
        ["valid_until", "=", (new Date(dr.toD)).toISOString()]
        ];

        let res = await new io_permission.SecretPermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        let res2 = await new io_permission.SecretPermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(0);

        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
    });

    test('grant 04 - mixed case', async () => {

        let name = "CAPS" + resource;
        let objMixedCase = new io_permission.SecretPermission()
            .name(name)
            .grantee(grantee);
        let objLower = new io_permission.SecretPermission()
            .name(name.toLowerCase())
            .grantee(grantee);

        //make sure no exist
        await io_utils.ignoreError(objLower.revoke(api));
        await io_utils.ignoreError(objMixedCase.revoke(api));

        //grant 1
        let r1 = await io_utils.noThrow(objMixedCase.grant(api));
        expect(r1.errors).toBe(false);
        //Grant 2
        let r2 = await io_utils.noThrow(objLower.grant(api));
        expect(r2.errors).toBe(true);
        //Revoke 1
        let r3 = await io_utils.noThrow(objMixedCase.revoke(api));
        expect(r3.errors).toBe(false);

        let filter = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, grantee]];
        let r5 = await io_utils.noThrow(new io_permission.SecretPermission().grantee(grantee).list(api, filter));
        expect(r5.totalCount).toBe(0);
    });

    test('test 05 role grant', async () => {
        //Create role
        let roleName = "test_permission_secret_." + testbatch;
        let role = new io_role.Role(roleName);
        await io_utils.ignoreError(role.delete(api));
        let x = await io_utils.noThrow(role.create(api));
        expect(x.error).toBe(false);

        //
        // GRANT
        //
        let obj = await new io_permission.SecretPermission()
            .name(resource)
            .grantee(roleName);
        await io_utils.ignoreError(obj.revoke(api));

        let f = [["permissiontype", io_utils.FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", io_utils.FILTER_OPERATION.EQUALS_STRING, roleName],
        ["key_name", io_utils.FILTER_OPERATION.EQUALS_STRING, resource]
        ];
        //make sure no exist        
        let res = await new io_permission.SecretPermission().grantee(roleName).list(api, f);
        expect(res.totalCount).toBe(0);

        let resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        res = await new io_permission.SecretPermission().grantee(roleName).list(api, f);
        expect(res.totalCount).toBe(1);

        let resp2 = await io_utils.ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await io_utils.noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //Delete role
        let d = await io_utils.noThrow(role.delete(api));
        expect(d.error).toBe(false);

    });



});

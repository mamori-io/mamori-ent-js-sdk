import { MamoriService } from '../../api';
import * as https from 'https';
import { IPResourcePermission, TIME_UNIT } from '../../permission';
import { addFilterToDxGridOptions, FILTER_OPERATION, handleAPIException, ignoreError, noThrow } from '../../utils';
import { Role } from '../../role';
import { WireGuardPeer } from '../../wireguard-peer';
import { assert } from 'console';
import { IpResource } from '../../ip-resource';
import { DBHelper } from '../../__utility__/test-helper';



const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("ip resource permission tests", () => {

    let api: MamoriService;
    let resource = "webaccess-" + testbatch;
    let permType = "IP USAGE";
    let grantee = "test_apiuser_ip." + testbatch;
    let granteepw = "J{J'vpKsn3213W6(6A,4_vdQ'}D"

    beforeAll(async () => {

        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        //create the user
        await ignoreError(api.delete_user(grantee));
        let result = await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        })

        //Create the IP Resource
        let cidr = "10.0.0.0/16";
        let ports = "7777";
        let baseR = await ignoreError(new IpResource(resource).withCIDR(cidr).withPorts(ports).create(api));
    });

    afterAll(async () => {
        await ignoreError(new IpResource(resource).delete(api));
        await api.delete_user(grantee);
        await api.logout();

    });

    test('grant 01', async () => {
        let obj = new IPResourcePermission()
            .resource(resource)
            .grantee(grantee);

        //make sure no exist
        await ignoreError(obj.revoke(api));
        //check list
        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee]];
        let res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);
        //grant
        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //check list
        res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        //try re-grant
        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);
        //revoke
        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //
        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

    });

    test('grant 02', async () => {
        let r1 = await new IPResourcePermission()
            .resource(resource)
            .grantee(grantee)
            .withValidFor(60, TIME_UNIT.MINUTES)
            .grant(api);

        expect(r1.errors).toBe(false);

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        ["key_name", FILTER_OPERATION.EQUALS_STRING, resource],
        ["time_left", ">", 3500]
        ];

        let res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);
        let id = res.data[0].id;
        let r2 = await noThrow(new IPResourcePermission().revokeByID(api, id));
        expect(r2.error).toBe(false);

        res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(0);

    });

    test('grant 03 - grant between', async () => {
        let dr = DBHelper.dateRange();


        let obj = await new IPResourcePermission()
            .resource(resource)
            .grantee(grantee)
            .withValidBetween(dr.fromDtz, dr.toDtz);

        await ignoreError(obj.revoke(api));
        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee],
        ["key_name", FILTER_OPERATION.EQUALS_STRING, resource],
        ["valid_from", "=", (new Date(dr.fromD)).toISOString()],
        ["valid_until", "=", (new Date(dr.toD)).toISOString()]
        ];

        let res = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res.totalCount).toBe(1);

        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        let res2 = await new IPResourcePermission().grantee(grantee).list(api, filter);
        expect(res2.totalCount).toBe(0);

        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

    });

    test('grant 04 - mixed case', async () => {
        let name = "CAPS" + resource;
        let objMixedCase = new IPResourcePermission()
            .resource(name)
            .grantee(grantee);
        let objLower = new IPResourcePermission()
            .resource(name.toLowerCase())
            .grantee(grantee);

        //make sure no exist
        await ignoreError(objLower.revoke(api));
        await ignoreError(objMixedCase.revoke(api));

        //grant 1
        let r1 = await noThrow(objMixedCase.grant(api));
        expect(r1.errors).toBe(false);
        //Grant 2
        let r2 = await noThrow(objLower.grant(api));
        expect(r2.errors).toBe(true);
        //Revoke 1
        let r3 = await noThrow(objMixedCase.revoke(api));
        expect(r3.errors).toBe(false);

        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, grantee]];
        let r5 = await noThrow(new IPResourcePermission().grantee(grantee).list(api, filter));
        expect(r5.totalCount).toBe(0);
        //revoke 2
        //let r4 = await noThrow(objLower.revoke(api));
        //console.log(r4);
        //expect(r4.errors).toBe(false);
        //
    });

    test.skip('test 05 role grant', async () => {

        //create the wg peer for the grantee
        let peer = "test_peer_" + testbatch;
        let k = new WireGuardPeer(grantee, peer);
        await noThrow(k.create(api));
        let payload = {};
        addFilterToDxGridOptions(payload, "userid", FILTER_OPERATION.EQUALS_STRING, grantee);
        let r6 = await noThrow(api.search_wireguard_peers(payload));
        expect(r6.data.length).toBeGreaterThan(0);
        let pPublicKey = r6.data[0].public_key;
        //
        let roleName = "test_permission_ip_." + testbatch;
        let role = new Role(roleName);
        await ignoreError(role.delete(api));
        let x = await noThrow(role.create(api));
        expect(x.error).toBe(false);

        //
        // GRANT
        //
        let obj = new IPResourcePermission()
            .resource(resource)
            .grantee(roleName);
        //make sure no exist
        await ignoreError(obj.revoke(api));
        //check list
        let filter = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, permType],
        ["grantee", FILTER_OPERATION.EQUALS_STRING, roleName]];
        let res = await new IPResourcePermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(0);
        //grant
        let resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);
        //check list
        res = await new IPResourcePermission().grantee(roleName).list(api, filter);
        expect(res.totalCount).toBe(1);
        //Grant role to grantee
        await noThrow(role.grantTo(api, grantee, false));
        await new Promise(resolve => setTimeout(resolve, 10000));
        //let r10 = await noThrow(new IPResourcePermission().resource(resource).grantee(grantee).grant(api));
        let r7 = await noThrow(api.get_wireguard_status());
        let r8 = r7.filter((o: any) => o.public_key === pPublicKey);
        //console.log("**** 111 %o", r8);
        expect(r8.length).toBeGreaterThan(0);
        expect(r8[0].allowed_dst_ip.length).toBe(2);
        //
        await noThrow(role.revokeFrom(api, grantee));
        await new Promise(resolve => setTimeout(resolve, 10000));
        let r9 = await noThrow(api.get_wireguard_status());
        let r10 = r9.filter((o: any) => o.public_key === pPublicKey);
        //expect(r10.length).toBe(0);
        //expect(r10[0].allowed_dst_ip.length).toBe(1)

        //try re-grant
        let resp2 = await ignoreError(obj.grant(api));
        expect(resp2.errors).toBe(true);
        //revoke
        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);
        //
        resp = await noThrow(obj.grant(api));
        expect(resp.errors).toBe(false);

        resp = await noThrow(obj.revoke(api));
        expect(resp.errors).toBe(false);

        await noThrow(role.revokeFrom(api, grantee));
        //Delete role
        let d = await noThrow(role.delete(api));
        expect(d.error).toBe(false);
    });

});

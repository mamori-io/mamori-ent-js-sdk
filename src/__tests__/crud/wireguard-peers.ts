import { MamoriService } from '../../api';
import * as https from 'https';
import { WireGuardPeer } from '../../wireguard-peer';
import { handleAPIException, noThrow, ignoreError, hex2a } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("wireguard peer tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_user_wg_peer" + testbatch;
    let granteepw = "J{J'v8@hs!$kjA(6A,4!98712_vdQ'}D"

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        })

        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);

    });

    afterAll(async () => {
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    test('peer 01', async done => {

        let name = "testlaptop";
        let k = new WireGuardPeer(grantee, name);
        let res = await noThrow(k.create(api));
        expect(res.config).toContain("[Interface]");
        //get list
        let filter = [["userid", "=", grantee], ["device_name", "", name]];
        let x = await noThrow(WireGuardPeer.list(api, 0, 10, filter));
        let peer = x.data[0];
        k.id = peer.id;
        expect(x.data.length).toBe(1);
        //
        //notify - causes timeout issues
        let x1 = await noThrow(k.sendNotification(api, res.config));
        expect(x1).toBe("ok");
        //
        //reset peer
        let x2 = await noThrow(k.reset(api, false));
        expect(x2.config).toContain("[Interface]");
        //lock peer
        let x3 = await noThrow(k.lock(api));
        expect(x3.status).toBe("ok");
        //unlock peer
        let x4 = await noThrow(k.unlock(api));
        expect(x4.status).toBe("ok");
        //delete peer
        let x5 = await noThrow(k.delete(api, k.id));
        expect(x5.status).toBe("ok");
        //
        done();
    });
});
import { MamoriService } from '../../api';
import * as https from 'https';
import { AlertChannel, HTTP_OPERATION } from "../../alert-channel";
import { WireGuardPeer } from '../../wireguard-peer';
import { handleAPIException, noThrow, ignoreError } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("alert channel tests", () => {

    let api: MamoriService;
    let grantee = "test_user_alert_channel" + testbatch;

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
    });

    afterAll(async () => {
        await api.logout();
    });

    test('alert 01', async () => {
        let name = "alerttest01" + testbatch;
        let k = new AlertChannel(name);
        //Delete old one
        let r2 = await noThrow(AlertChannel.get(api, name));
        if (r2) {
            await ignoreError(r2.delete(api));
        }
        k.addEmailAlert("omasri@mamori.io", "test subject", "My Message");
        let body = {
            "attachments": [
                {
                    "color": "#f93836",
                    "pretext": "A wireguard peer has been blocked",
                    "author_name": "Mamori",
                    "title": "Wireguard peer blocked - {{device}}",
                    "text": "User: {{username}} - client ip: {{source}}",
                    "footer": "This is a Mamori Peer Notification",
                }
            ]
        };
        k.addHTTPAlert(HTTP_OPERATION.POST
            , ""
            , "https://hooks.slack.com/services/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"
            , JSON.stringify(body)
            , "application/json")
        k.addPushNotificationAlert("{{applicant}}", "Test Message");
        k.fromJSON(k.toJSON());
        let r = await noThrow(k.create(api));
        expect(r.id).toBeDefined();
        k.id = r.id;
        //await ignoreError(k.delete(api));
        //let r3 = await noThrow(AlertChannel.get(api, name));
        //expect(r3).toBeNull();
    });
});
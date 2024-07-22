import { io_policy, MamoriService } from '../../api';
import { io_utils, io_permission, io_alertchannel, io_https, io_role, io_user } from '../../api';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("on-demand policy crud tests", () => {

    let api: MamoriService;
    let requestAlert = new io_alertchannel.AlertChannel("test_c_policy_request_alert" + testbatch);

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        requestAlert.addEmailAlert("omasri@mamori.io,test@mamori.io", "request alert", "REQUEST BODY");
        let r = await io_utils.noThrow(requestAlert.create(api));
        if (r && r.id) {
            requestAlert.id = r.id;
        }
    });

    afterAll(async () => {
        await io_utils.ignoreError(requestAlert.delete(api));
        await api.logout();
    });

    test('policy 01', async () => {
        let name = "test_c_policy_" + testbatch;

        let cleanit = await io_utils.noThrow(io_policy.ConnectionPolicy.listBefore(api, { description: name }));
        if (cleanit.length > 0) {
            let p2 = io_policy.ConnectionPolicy.build(cleanit[0]);
            await io_utils.noThrow(p2.delete(api));
        }

        let policy = new io_policy.ConnectionPolicy(io_policy.POLICY_TYPES.BEFORE_CONNECTION, name);
        policy.withEnabled(false)
            .withPosition(20)
            .withEnabled(false)
            .withAction(io_policy.POLICY_ACTIONS.ALLOW)
            .withRuleType(io_policy.POLICY_RULE_TYPE.WHEN)
            .withRuleSEXP("(SOURCE-IP 127.0.0.1)")
            .withAlert(requestAlert.name);
        let x = await io_utils.noThrow(policy.create(api));
        expect(x.error).toBe(false);

        //Test select
        let x2 = await io_utils.noThrow(io_policy.ConnectionPolicy.listBefore(api, { description: name }));
        expect(x2.length).toBe(1);

        //Text get by ID
        let x3 = await io_utils.noThrow(io_policy.ConnectionPolicy.get(api, x2[0].id));
        expect(x3.length).toBe(1);
        let x4 = x3[0];

        //Test delete
        policy.id = x4.id;
        let x5 = await io_utils.noThrow(policy.delete(api));
        expect(x5.error).toBe(false);

        //Test FROM JSON
        let p2 = io_policy.ConnectionPolicy.build(x4);
        let x6 = await io_utils.noThrow(p2.create(api));
        expect(x6.error).toBe(false);
        let x7 = await io_utils.noThrow(io_policy.ConnectionPolicy.listBefore(api, { description: name }));
        expect(x7.length).toBe(1);

        let p3 = io_policy.ConnectionPolicy.build(x7[0]);
        let x8 = await io_utils.noThrow(p3.delete(api));
        expect(x8.error).toBe(false);

    });

    test('policy 02', async () => {
        let name = "test_s_policy_" + testbatch;
        //
        let cleanit = await io_utils.noThrow(io_policy.StatementPolicy.list(api, { description: name }));
        if (cleanit.length > 0) {
            let p2 = io_policy.ConnectionPolicy.build(cleanit[0]);
            await io_utils.noThrow(p2.delete(api));
        }

        let policy = new io_policy.StatementPolicy(name);
        policy.withEnabled(false)
            .withPosition(20)
            .withEnabled(false)
            .withAction(io_policy.POLICY_ACTIONS.ALLOW)
            .withRuleType(io_policy.POLICY_RULE_TYPE.WHEN)
            .withRuleSEXP("(REFERENCES-TABLE 'mamori')")
            .withAlert(requestAlert.name);
        let x = await io_utils.noThrow(policy.create(api));
        expect(x.error).toBe(false);

        //Test select
        let x2 = await io_utils.noThrow(io_policy.StatementPolicy.list(api, { description: name }));
        expect(x2.length).toBe(1);

        //Text get by ID
        let x3 = await io_utils.noThrow(io_policy.StatementPolicy.get(api, x2[0].id));
        expect(x3.length).toBe(1);
        let x4 = x3[0];

        //Test delete
        policy.id = x4.id;
        let x5 = await io_utils.noThrow(policy.delete(api));
        expect(x5.error).toBe(false);

        //Test FROM JSON
        let p2 = io_policy.StatementPolicy.build(x4);
        let x6 = await io_utils.noThrow(p2.create(api));
        expect(x6.error).toBe(false);
        let x7 = await io_utils.noThrow(io_policy.StatementPolicy.list(api, { description: name }));
        expect(x7.length).toBe(1);

        let p3 = io_policy.StatementPolicy.build(x7[0]);
        let x8 = await io_utils.noThrow(p3.delete(api));
        expect(x8.error).toBe(false);
    });

});

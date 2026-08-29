import { MamoriService, io_https, io_utils, io_eventhandler } from '../../api';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const TRIGGER_BODY = 'out.write("trigger-ok");';
const RULE_BODY = 'return true;';
const POLICY_DATA_BODY = 'return { valid: true, message: "ok", result: { ticket: context.getParameter("ticket_number") } };';

const TRIGGER_PAYLOAD = {
    name: "sdk-test",
    policy: {
        connection: {
            username: "alice",
            sourceIp: "10.0.0.1",
            system: "prod-db",
            systemType: "postgresql",
            roles: ["analyst"],
            clientTool: "psql",
            connectionId: 1,
            alertKey: "sample-alert",
        },
        statement: {
            statementType: "SELECT",
            targetObjectType: "TABLE",
            targetObject: "public.customers",
        },
    },
};

const RULE_PAYLOAD = {
    username: "alice",
    sourceIp: "10.0.0.1",
    system: "prod-db",
    systemType: "postgresql",
    statementType: "SELECT",
    targetObjectType: "TABLE",
    targetObject: "public.customers",
    connectionId: 1,
    roles: ["analyst"],
};

const POLICY_DATA_PAYLOAD = {
    policyName: "sdk_sample_procedure",
    applicant: "alice",
    applicantMessage: "Please approve access",
    parameters: { ticket_number: "TK-100001", priority: "high" },
    requestableParameters: { database: "prod" },
};

describe("event handler create and test", () => {

    let api: MamoriService;
    let names = {
        trigger: "test_eh_trigger_" + testbatch,
        rule: "test_eh_rule_" + testbatch,
        policy_data: "test_eh_policy_data_" + testbatch,
    };

    beforeAll(async () => {
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        await cleanup();
    });

    afterAll(async () => {
        await cleanup();
        await api.logout();
    });

    async function cleanup() {
        for (const type of Object.keys(names) as Array<keyof typeof names>) {
            let existing = await io_utils.ignoreError(
                io_eventhandler.EventHandler.getByName(api, names[type], type)
            );
            if (existing && existing.id) {
                await io_utils.ignoreError(existing.delete(api));
            }
        }
    }

    async function createAndTest(
        type: string,
        name: string,
        body: string,
        payload: any,
        assertResult: (r: any) => void
    ) {
        let handler = new io_eventhandler.EventHandler(name, type, body);
        let created = await io_utils.noThrow(handler.create(api));
        expect(created).toSucceed();

        let stored = await io_utils.noThrow(io_eventhandler.EventHandler.getByName(api, name, type));
        expect(stored).toBeTruthy();
        expect(stored.type).toBe(type);
        handler.id = stored.id;

        let result = await io_utils.noThrow(handler.test(api, payload));
        expect(result.errors).not.toBe(true);
        expect(result.success).toBe(true);
        assertResult(result);

        let deleted = await io_utils.noThrow(handler.delete(api));
        expect(deleted).toSucceed();
    }

    test("trigger handler create and test", async () => {
        await createAndTest(
            io_eventhandler.EVENT_HANDLER_TYPE.TRIGGER,
            names.trigger,
            TRIGGER_BODY,
            TRIGGER_PAYLOAD,
            (r) => {
                expect(String(r.output || "")).toContain("trigger-ok");
            }
        );
    });

    test("rule handler create and test", async () => {
        await createAndTest(
            io_eventhandler.EVENT_HANDLER_TYPE.RULE,
            names.rule,
            RULE_BODY,
            RULE_PAYLOAD,
            (r) => {
                expect(r.result === true || r.result === "true").toBe(true);
            }
        );
    });

    test("policy_data handler create and test", async () => {
        await createAndTest(
            io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA,
            names.policy_data,
            POLICY_DATA_BODY,
            POLICY_DATA_PAYLOAD,
            (r) => {
                expect(r.result).toBeDefined();
                expect(r.result.valid).toBe(true);
                expect(r.result.result && r.result.result.ticket).toBe("TK-100001");
            }
        );
    });
});

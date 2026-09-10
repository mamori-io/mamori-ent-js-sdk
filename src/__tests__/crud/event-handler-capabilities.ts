import { MamoriService, io_https, io_utils, io_eventhandler, io_secret, io_role } from "../../api";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const handlerName = "test_eh_caps_deny_" + testbatch;
const secretName = "test_eh_caps_secret_" + testbatch;
const roleName = "test_eh_caps_role_" + testbatch;

const POLICY_PAYLOAD = {
    policyName: "sdk_caps_deny_procedure",
    applicant: username,
    applicantMessage: "capability deny test",
    parameters: { ticket_number: "N/A" },
    requestableParameters: {},
};

function expectCapabilityDenial(result: any, capability: string) {
    expect(result.errors).not.toBe(true);
    expect(result.success).toBe(false);
    const err = String(result.error || "");
    expect(err).toContain(capability);
    expect(err).toMatch(/Grant '.+' to this event handler/);
    expect(err).toMatch(/failed: missing permission/i);
}

describe("event handler capability denials", () => {
    let api: MamoriService;
    let handler: io_eventhandler.EventHandler | null = null;

    beforeAll(async () => {
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        await cleanup();
    });

    afterAll(async () => {
        await cleanup();
        await api.logout();
    });

    async function cleanupHandlerOnly() {
        let existing = await io_utils.ignoreError(
            io_eventhandler.EventHandler.getByName(
                api,
                handlerName,
                io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA
            )
        );
        if (existing && existing.id) {
            await io_utils.ignoreError(existing.delete(api));
        }
        handler = null;
    }

    async function cleanup() {
        await cleanupHandlerOnly();
        await io_utils.ignoreError(io_secret.Secret.deleteByName(api, secretName));
        await io_utils.ignoreError(new io_role.Role(roleName).delete(api));
    }

    async function createDenyHandler(body: string) {
        await cleanupHandlerOnly();
        handler = new io_eventhandler.EventHandler(
            handlerName,
            io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA,
            body
        ).withCapabilities([]);
        let created = await io_utils.noThrow(handler.create(api));
        expect(created.errors).not.toBe(true);
        let stored = await io_utils.noThrow(
            io_eventhandler.EventHandler.getByName(
                api,
                handlerName,
                io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA
            )
        );
        expect(stored).toBeTruthy();
        handler.id = stored!.id;
        handler.capabilities = [];
        return handler;
    }

    test("deny EVENT HANDLER HTTP for httpGet", async () => {
        await createDenyHandler(
            'mamori.httpGet("https://example.com/");\nreturn { valid: true, message: "", result: {} };'
        );
        let result = await io_utils.noThrow(handler!.test(api, POLICY_PAYLOAD));
        expectCapabilityDenial(result, "EVENT HANDLER HTTP");
    });

    test("deny EVENT HANDLER HTTP for httpPost", async () => {
        await createDenyHandler(
            'mamori.httpPost("https://example.com/", "{}");\nreturn { valid: true, message: "", result: {} };'
        );
        let result = await io_utils.noThrow(handler!.test(api, POLICY_PAYLOAD));
        expectCapabilityDenial(result, "EVENT HANDLER HTTP");
    });

    test("deny ALERT", async () => {
        await createDenyHandler(
            'mamori.alert("nosuch_alert", mamori.makeFacts({}));\nreturn { valid: true, message: "", result: {} };'
        );
        let result = await io_utils.noThrow(handler!.test(api, POLICY_PAYLOAD));
        expectCapabilityDenial(result, "ALERT");
    });

    test("deny SET SYSTEM PROPERTY", async () => {
        await createDenyHandler(
            'mamori.getServerProperty("fqe.something", "x");\nreturn { valid: true, message: "", result: {} };'
        );
        let result = await io_utils.noThrow(handler!.test(api, POLICY_PAYLOAD));
        expectCapabilityDenial(result, "SET SYSTEM PROPERTY");
    });

    test("deny MAMORI SECURITY CATALOG", async () => {
        await createDenyHandler(
            "var facts = mamori.makeFacts({ username: " +
                JSON.stringify(username) +
                ', dm_sid: "x" });\n' +
                "mamori.getDuplicateSessions(facts);\n" +
                'return { valid: true, message: "", result: {} };'
        );
        let result = await io_utils.noThrow(handler!.test(api, POLICY_PAYLOAD));
        expectCapabilityDenial(result, "MAMORI SECURITY CATALOG");
    });

    test("deny KILL SESSION", async () => {
        await createDenyHandler(
            'mamori.killSession("00000000-0000-0000-0000-000000000000");\nreturn { valid: true, message: "", result: {} };'
        );
        let result = await io_utils.noThrow(handler!.test(api, POLICY_PAYLOAD));
        expectCapabilityDenial(result, "KILL SESSION");
    });

    test("deny REVEAL SECRET without handler capability", async () => {
        let secret = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, secretName)
            .withSecret("TESTVALUE")
            .withUsername("testUser")
            .withHost("10.123.0.100")
            .withDescription("SDK capability deny getSecret test");
        let createdSecret = await io_utils.noThrow(secret.create(api));
        expect(createdSecret.errors).not.toBe(true);

        let role = new io_role.Role(roleName);
        let createdRole = await io_utils.noThrow(role.create(api));
        expect(createdRole.errors).not.toBe(true);

        // No secret grant and no handler capability — denial must name REVEAL SECRET on the handler
        await createDenyHandler(
            "mamori.getSecret(" +
                JSON.stringify(roleName) +
                ", " +
                JSON.stringify(secretName) +
                ");\n" +
                'return { valid: true, message: "", result: {} };'
        );
        let result = await io_utils.noThrow(handler!.test(api, POLICY_PAYLOAD));
        expectCapabilityDenial(result, "REVEAL SECRET");
    });
});

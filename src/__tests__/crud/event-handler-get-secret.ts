import { MamoriService, io_https, io_utils, io_eventhandler, io_secret, io_role } from "../../api";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const SECRET_VALUE = "TESTVALUE";
const secretName = "test_eh_getsecret_secret_" + testbatch;
const roleName = "test_eh_getsecret_role_" + testbatch;
const handlerName = "test_eh_getsecret_handler_" + testbatch;

describe("event handler getSecret", () => {
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

    async function cleanup() {
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

        await io_utils.ignoreError(io_secret.Secret.deleteByName(api, secretName));
        await io_utils.ignoreError(new io_role.Role(roleName).delete(api));
    }

    test("creates secret, role with REVEAL SECRET, event handler that asserts getSecret value", async () => {
        // 1. Create secret with value TESTVALUE
        let secret = new io_secret.Secret(io_secret.SECRET_PROTOCOL.GENERIC, secretName)
            .withSecret(SECRET_VALUE)
            .withUsername("testUser")
            .withHost("10.123.0.100")
            .withDescription("SDK getSecret event handler test");
        let createdSecret = await io_utils.noThrow(secret.create(api));
        expect(createdSecret.errors).not.toBe(true);
        expect(createdSecret.status).toBe("OK");

        let storedSecret = await io_utils.noThrow(io_secret.Secret.getByName(api, secretName));
        expect(storedSecret).toBeTruthy();
        expect(storedSecret.name).toBe(secretName);

        // 2. Create role and grant REVEAL SECRET on the secret
        let role = new io_role.Role(roleName);
        let createdRole = await io_utils.noThrow(role.create(api));
        expect(createdRole.errors).not.toBe(true);

        let grant = await io_utils.noThrow(storedSecret.grantTo(api, roleName));
        expect(grant.errors).toBe(false);

        // 3. Create policy_data handler that returns valid:true when getSecret returns TESTVALUE
        let body =
            "var value = mamori.getSecret(" +
            JSON.stringify(roleName) +
            ", " +
            JSON.stringify(secretName) +
            ");\n" +
            "var ok = value === " +
            JSON.stringify(SECRET_VALUE) +
            ";\n" +
            "return { valid: ok, message: ok ? \"\" : \"secret mismatch: \" + value, result: { matched: ok } };";

        handler = new io_eventhandler.EventHandler(
            handlerName,
            io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA,
            body
        );
        let createdHandler = await io_utils.noThrow(handler.create(api));
        expect(createdHandler.errors).not.toBe(true);

        let storedHandler = await io_utils.noThrow(
            io_eventhandler.EventHandler.getByName(
                api,
                handlerName,
                io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA
            )
        );
        expect(storedHandler).toBeTruthy();
        handler.id = storedHandler.id;

        // 4. Test the event handler and assert it returns valid true
        let payload = {
            policyName: "sdk_getsecret_procedure",
            applicant: username,
            applicantMessage: "getSecret test",
            parameters: { ticket_number: "N/A" },
            requestableParameters: {},
        };
        let result = await io_utils.noThrow(handler.test(api, payload));
        if (result.success !== true) {
            throw new Error(
                "event handler test failed: " +
                    JSON.stringify({
                        success: result.success,
                        error: result.error,
                        output: result.output,
                        result: result.result,
                    })
            );
        }
        expect(result.errors).not.toBe(true);
        expect(result.success).toBe(true);
        expect(result.result).toBeDefined();

        let parsed =
            typeof result.result === "string"
                ? JSON.parse(result.result)
                : result.result;
        expect(parsed.valid === true || parsed.valid === "true").toBe(true);
        expect(parsed.result && (parsed.result.matched === true || parsed.result.matched === "true")).toBe(
            true
        );
    });
});

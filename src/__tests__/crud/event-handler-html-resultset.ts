import { MamoriService, io_https, io_utils, io_eventhandler } from "../../api";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const handlerName = "test_eh_html_ident_" + testbatch;

const POLICY_PAYLOAD = {
    policyName: "sdk_html_ident_procedure",
    applicant: username,
    applicantMessage: "HtmlResultSet identifier guard test",
    parameters: { ticket_number: "N/A" },
    requestableParameters: {},
};

/**
 * Valid MSQL identifier aliases reach ResultSet metadata and toHTML.
 * Unquoted invalid identifiers fail at mamori.query.
 */
describe("event handler query column identifiers", () => {
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
    }

    async function createAndTest(body: string) {
        await cleanup();

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

        let result = await io_utils.noThrow(handler.test(api, POLICY_PAYLOAD));
        if (result.success !== true) {
            throw new Error(
                "event handler test failed: " +
                    JSON.stringify({
                        success: result.success,
                        error: result.error,
                        output: result.output,
                        result: result.result,
                        errors: result.errors,
                        message: result.message,
                        httpStatus: result.response && result.response.status,
                        httpData: result.response && result.response.data,
                    })
            );
        }
        expect(result.errors).not.toBe(true);
        expect(result.success).toBe(true);

        return typeof result.result === "string" ? JSON.parse(result.result) : result.result;
    }

    test("valid identifier alias succeeds and toHTML returns header", async () => {
        const body =
            "var rs = mamori.query('SELECT 1 AS safe_col FROM SYS.DUAL');\n" +
            "var html = rs.toHTML().getText();\n" +
            "var lower = html.toLowerCase();\n" +
            "var ok = lower.indexOf('<th>') >= 0 && lower.indexOf('safe_col') >= 0;\n" +
            'return { valid: ok, message: ok ? "" : ("unexpected html: " + html), result: { html: html } };';

        let parsed = await createAndTest(body);
        expect(parsed.valid === true || parsed.valid === "true").toBe(true);
        expect(String(parsed.result.html).toLowerCase()).toContain("safe_col");
    });

    test("invalid identifier alias fails the query", async () => {
        // Unquoted hyphenated alias is a lexical/syntax error (not a delimited identifier).
        const body =
            "var rejected = false;\n" +
            "var err = '';\n" +
            "try {\n" +
            "  mamori.query('SELECT 1 AS bad-name FROM SYS.DUAL');\n" +
            "} catch (e) {\n" +
            "  rejected = true;\n" +
            "  err = String(e && e.message ? e.message : e);\n" +
            "}\n" +
            "var ok = rejected;\n" +
            'return { valid: ok, message: ok ? "" : "expected query to reject invalid identifier", result: { rejected: rejected, error: err } };';

        let parsed = await createAndTest(body);
        expect(parsed.valid === true || parsed.valid === "true").toBe(true);
        expect(parsed.result.rejected === true || parsed.result.rejected === "true").toBe(true);
        expect(String(parsed.result.error || "").length).toBeGreaterThan(0);
    });
});

import { MamoriService, io_https, io_utils, io_eventhandler, io_ondemandpolicies, io_role } from "../../api";
import { selectQuery } from "../../__utility__/test-helper";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

const TICKET_REGEX = /^TK-\d{6}$/;

function uniqueSuffix(): string {
    return (
        String(testbatch) +
        "_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2, 8)
    ).replace(/[^a-zA-Z0-9_]/g, "_");
}

function col(row: any, name: string): any {
    if (!row) {
        return undefined;
    }
    if (row[name] !== undefined) {
        return row[name];
    }
    const upper = name.toUpperCase();
    if (row[upper] !== undefined) {
        return row[upper];
    }
    const lower = name.toLowerCase();
    if (row[lower] !== undefined) {
        return row[lower];
    }
    return undefined;
}

function isTrue(value: any): boolean {
    return value === true || value === "true";
}

function sqlQuote(value: string): string {
    return "'" + io_utils.sqlEscape(value) + "'";
}

function parametersJson(parameters: Record<string, string>, message: string = "Please approve"): string {
    return JSON.stringify({
        parameters: parameters,
        message: message,
        requestable_parameters: {},
    });
}

describe("policy request validation (mobile MSQL + V2 call)", () => {
    let api: MamoriService;
    const uid = uniqueSuffix();
    const policyName = "test_pol_reqval_" + uid;
    const endorseRole = "test_pol_reqval_end_" + uid;
    const ticketHandlerName = "test_pd_ticket_" + uid;
    const noteHandlerName = "test_pd_note_" + uid;

    let procedureId = 0;
    let paramsByName: Record<string, any> = {};

    const baseParameters: Record<string, string> = {
        note: "hello",
        qty: "7",
        flag: "false",
        start_date: "2026-08-30 10:00",
        end_date: "2026-08-30 18:00",
        ticket_number: "TK-123456",
        priority: "med",
    };

    beforeAll(async () => {
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        await cleanup();

        let ticketHandler = new io_eventhandler.EventHandler(
            ticketHandlerName,
            io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA,
            [
                'if (String(context.getParameter("ticket_number") || "") === "TK-000000") {',
                '  return { valid: false, message: "Ticket rejected by handler" };',
                "}",
                'return { valid: true, message: "ok", result: { ticket: context.getParameter("ticket_number") } };',
            ].join("\n")
        );
        let noteHandler = new io_eventhandler.EventHandler(
            noteHandlerName,
            io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA,
            [
                'if (String(context.getParameter("note") || "") === "bad") {',
                '  return { valid: false, message: "Invalid note" };',
                "}",
                'return { valid: true, message: "ok" };',
            ].join("\n")
        );
        expect(await io_utils.noThrow(ticketHandler.create(api))).toSucceed();
        expect(await io_utils.noThrow(noteHandler.create(api))).toSucceed();

        await io_utils.ignoreError(new io_role.Role(endorseRole).delete(api));
        expect(await io_utils.noThrow(new io_role.Role(endorseRole).create(api))).toSucceed();

        let policy = new io_ondemandpolicies.OnDemandPolicy(policyName);
        policy.description = "sdk request validation " + uid;
        policy.requires = endorseRole;
        policy.external_ticket_number_required = "true";
        policy.ticket_number_regex = "TK-\\d{6}";
        policy.ticket_number_regex_display_hint = "TK-######";
        policy.ticket_number_validation = ticketHandlerName;
        policy.request_priority_required = "true";
        policy.addParameter("note", "Note", "", "string", { validation_handler: noteHandlerName });
        policy.addParameter("qty", "Quantity", "7", "number", { min_value: "1", max_value: "30" });
        policy.addParameter("flag", "Flag", "false", "boolean");
        policy.addParameter("start_date", "Start", "", "datetime", {
            date_range_pairing: "from",
            date_range_pair: "end_date",
            max_time_hours: "24",
        });
        policy.addParameter("end_date", "End", "", "datetime", {
            date_range_pairing: "to",
            date_range_pair: "start_date",
            max_time_hours: "24",
        });
        policy.withScript(["GRANT SELECT ON * TO :APPLICANT VALID FOR 15 minutes"]);
        expect(await io_utils.noThrow(policy.create(api))).toSucceed();

        await loadCatalog();
    });

    afterAll(async () => {
        await cleanup();
        if (api) {
            await api.logout();
        }
    });

    async function cleanup() {
        await io_utils.ignoreError(new io_ondemandpolicies.OnDemandPolicy(policyName).delete(api));
        await io_utils.ignoreError(new io_role.Role(endorseRole).delete(api));
        for (const name of [ticketHandlerName, noteHandlerName]) {
            let existing = await io_utils.ignoreError(
                io_eventhandler.EventHandler.getByName(api, name, io_eventhandler.EVENT_HANDLER_TYPE.POLICY_DATA)
            );
            if (existing && existing.id) {
                await io_utils.ignoreError(existing.delete(api));
            }
        }
    }

    async function loadCatalog() {
        let procedures = await selectQuery(
            api,
            "SELECT * FROM SYS.PROCEDURES WHERE lower(name) = lower(" + sqlQuote(policyName) + ")"
        );
        expect(procedures.errors).not.toBe(true);
        expect(procedures.length).toBeGreaterThan(0);
        procedureId = Number(col(procedures[0], "id"));
        expect(procedureId).toBeGreaterThan(0);

        let options = await selectQuery(
            api,
            "SELECT * FROM SYS.PROCEDURE_OPTIONS WHERE procedure_id = " + procedureId
        );
        expect(options.errors).not.toBe(true);

        let parameters = await selectQuery(
            api,
            "SELECT * FROM SYS.PROCEDURE_PARAMETERS WHERE procedure_id = " + procedureId + " ORDER BY position"
        );
        expect(parameters.errors).not.toBe(true);
        paramsByName = {};
        for (const row of parameters) {
            paramsByName[String(col(row, "name"))] = row;
        }
        expect(paramsByName.note).toBeDefined();
        expect(paramsByName.start_date).toBeDefined();
        expect(paramsByName.end_date).toBeDefined();
        expect(paramsByName.qty).toBeDefined();
        return { procedures, options, parameters };
    }

    function parameterId(name: string): number {
        return Number(col(paramsByName[name], "id"));
    }

    async function callTicket(parameters: Record<string, string>): Promise<any> {
        const sql =
            "call CALL_POLICY_TICKET_NUMBER_VALIDATION(" +
            procedureId +
            ", " +
            sqlQuote(parametersJson(parameters)) +
            ")";
        let rows = await selectQuery(api, sql);
        expect(rows).toSucceed();
        return Array.isArray(rows) ? rows[0] : rows;
    }

    async function callParameter(name: string, parameters: Record<string, string>): Promise<any> {
        const sql =
            "call CALL_POLICY_PARAMETER_VALIDATION(" +
            procedureId +
            ", " +
            parameterId(name) +
            ", " +
            sqlQuote(parametersJson(parameters)) +
            ")";
        let rows = await selectQuery(api, sql);
        expect(rows).toSucceed();
        return Array.isArray(rows) ? rows[0] : rows;
    }

    async function callTicketV2(parameters: Record<string, string>): Promise<any> {
        let rows = await io_utils.noThrow(
            api.call("CALL_POLICY_TICKET_NUMBER_VALIDATION", procedureId, parametersJson(parameters))
        );
        expect(rows).toSucceed();
        return Array.isArray(rows) ? rows[0] : rows;
    }

    async function callParameterV2(name: string, parameters: Record<string, string>): Promise<any> {
        let rows = await io_utils.noThrow(
            api.call(
                "CALL_POLICY_PARAMETER_VALIDATION",
                procedureId,
                parameterId(name),
                parametersJson(parameters)
            )
        );
        expect(rows).toSucceed();
        return Array.isArray(rows) ? rows[0] : rows;
    }

    test("mobile load order: SYS procedures, options, parameters, MOBILE_APP_OPTIONS", async () => {
        let catalog = await loadCatalog();
        expect(catalog.procedures.length).toBe(1);
        expect(catalog.parameters.length).toBe(5);

        let mobileOptions = await selectQuery(api, "call MOBILE_APP_OPTIONS()");
        expect(mobileOptions).toSucceed();
        expect(Array.isArray(mobileOptions) ? mobileOptions.length : 1).toBeGreaterThan(0);

        let optionNames = catalog.options.map((row: any) => String(col(row, "name") || "").toLowerCase());
        expect(optionNames).toContain("ticket_number_validation");
        expect(optionNames).toContain("ticket_number_regex");
    });

    test("local ticket regex and number min/max stay on the client", async () => {
        expect(TICKET_REGEX.test("TK-123456")).toBe(true);
        expect(TICKET_REGEX.test("ABC")).toBe(false);
        const qty = Number("50");
        expect(qty >= 1 && qty <= 30).toBe(false);
        const okQty = Number("7");
        expect(okQty >= 1 && okQty <= 30).toBe(true);
    });

    test("ticket CALL accepts a valid ticket and rejects handler failure", async () => {
        let okRow = await callTicket(baseParameters);
        expect(isTrue(col(okRow, "valid"))).toBe(true);

        let badRow = await callTicket({ ...baseParameters, ticket_number: "TK-000000" });
        expect(isTrue(col(badRow, "valid"))).toBe(false);
        expect(String(col(badRow, "message") || "")).toContain("Ticket rejected");
    });

    test("string parameter CALL runs the event handler", async () => {
        let okRow = await callParameter("note", baseParameters);
        expect(isTrue(col(okRow, "valid"))).toBe(true);

        let badRow = await callParameter("note", { ...baseParameters, note: "bad" });
        expect(isTrue(col(badRow, "valid"))).toBe(false);
        expect(String(col(badRow, "message") || "")).toContain("Invalid note");
    });

    test("datetime CALL validates format, from/to, and max hours", async () => {
        let okPair = await callParameter("start_date", baseParameters);
        expect(isTrue(col(okPair, "valid"))).toBe(true);

        let inverted = await callParameter("start_date", {
            ...baseParameters,
            start_date: "2026-08-30 18:00",
            end_date: "2026-08-30 10:00",
        });
        expect(isTrue(col(inverted, "valid"))).toBe(false);
        expect(String(col(inverted, "message") || "")).toContain("From date must be before or equal to To date");

        let tooLong = await callParameter("end_date", {
            ...baseParameters,
            start_date: "2026-08-30 10:00",
            end_date: "2026-08-31 12:00",
        });
        expect(isTrue(col(tooLong, "valid"))).toBe(false);
        expect(String(col(tooLong, "message") || "")).toContain("Time range must be at most 24 hours");

        let badFormat = await callParameter("start_date", { ...baseParameters, start_date: "not-a-date" });
        expect(isTrue(col(badFormat, "valid"))).toBe(false);
        expect(String(col(badFormat, "message") || "")).toContain("Invalid datetime");

        let missingPeer = await callParameter("start_date", { ...baseParameters, end_date: "" });
        expect(isTrue(col(missingPeer, "valid"))).toBe(true);
    });

    test("number parameter CALL does not enforce min/max", async () => {
        let row = await callParameter("qty", { ...baseParameters, qty: "50" });
        expect(isTrue(col(row, "valid"))).toBe(true);
    });

    test("V2 call matches the mobile MSQL CALLs", async () => {
        let ticketCall = await callTicket(baseParameters);
        let ticketV2 = await callTicketV2(baseParameters);
        expect(isTrue(col(ticketV2, "valid"))).toBe(isTrue(col(ticketCall, "valid")));

        let noteCall = await callParameter("note", baseParameters);
        let noteV2 = await callParameterV2("note", baseParameters);
        expect(isTrue(col(noteV2, "valid"))).toBe(isTrue(col(noteCall, "valid")));

        let startCall = await callParameter("start_date", baseParameters);
        let startV2 = await callParameterV2("start_date", baseParameters);
        expect(isTrue(col(startV2, "valid"))).toBe(isTrue(col(startCall, "valid")));
    });
});

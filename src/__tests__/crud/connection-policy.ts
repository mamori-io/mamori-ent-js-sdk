import { io_policy, MamoriService } from "../../api";
import {
  io_utils,
  io_permission,
  io_alertchannel,
  io_https,
  io_role,
  io_user,
} from "../../api";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("connection and statement policy crud tests", () => {
  let api: MamoriService;
  let requestAlert = new io_alertchannel.AlertChannel(
    "test_c_policy_request_alert" + testbatch,
  );

  beforeAll(async () => {
    //console.log("login %s %s", host, username);
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);

    requestAlert.addEmailAlert(
      "omasri@mamori.io,test@mamori.io",
      "request alert",
      "REQUEST BODY",
    );
    let r = await io_utils.noThrow(requestAlert.create(api));
    if (r && r.id) {
      requestAlert.id = r.id;
    }
  });

  afterAll(async () => {
    await io_utils.ignoreError(requestAlert.delete(api));
    await api.logout();
  });

  test("policy 01", async () => {
    let name = "test_c_policy_" + testbatch;

    let cleanit = await io_utils.noThrow(
      io_policy.ConnectionPolicy.listBefore(api, { description: name }),
    );
    if (cleanit.length > 0) {
      let p2 = io_policy.ConnectionPolicy.build(cleanit[0]);
      await io_utils.noThrow(p2.delete(api));
    }

    let policy = new io_policy.ConnectionPolicy(
      io_policy.POLICY_TYPES.BEFORE_CONNECTION,
      name,
    );
    const eventHandlerName = "test_eh_" + testbatch;
    policy
      .withEnabled(false)
      .withPosition(20)
      .withEnabled(false)
      .withAction(io_policy.POLICY_ACTIONS.ALLOW)
      .withRuleType(io_policy.POLICY_RULE_TYPE.WHEN)
      .withRuleSEXP("(SOURCE-IP 127.0.0.1)")
      .withAlert(requestAlert.name)
      .withEventHandler(eventHandlerName);
    let x = await io_utils.noThrow(policy.create(api));
    expect(x).toSucceed();

    //Test select
    let x2 = await io_utils.noThrow(
      io_policy.ConnectionPolicy.listBefore(api, { description: name }),
    );
    expect(x2.length).toBe(1);

    //Text get by ID
    let x3 = await io_utils.noThrow(
      io_policy.ConnectionPolicy.get(api, x2[0].id),
    );
    expect(x3.length).toBe(1);
    let x4 = x3[0];
    if (x4.event_handler !== undefined) {
      expect(x4.event_handler).toBe(eventHandlerName);
    }

    //Test delete
    policy.id = x4.id;
    let x5 = await io_utils.noThrow(policy.delete(api));
    expect(x5).toSucceed();

    //Test FROM JSON
    let p2 = io_policy.ConnectionPolicy.build(x4);
    let x6 = await io_utils.noThrow(p2.create(api));
    expect(x6).toSucceed();
    let x7 = await io_utils.noThrow(
      io_policy.ConnectionPolicy.listBefore(api, { description: name }),
    );
    expect(x7.length).toBe(1);

    let p3 = io_policy.ConnectionPolicy.build(x7[0]);
    let x8 = await io_utils.noThrow(p3.delete(api));
    expect(x8).toSucceed();
  });

  test("policy 02", async () => {
    let name = "test_s_policy_" + testbatch;
    //
    let cleanit = await io_utils.noThrow(
      io_policy.StatementPolicy.list(api, { description: name }),
    );
    if (cleanit.length > 0) {
      let p2 = io_policy.ConnectionPolicy.build(cleanit[0]);
      await io_utils.noThrow(p2.delete(api));
    }

    const eventHandlerName = "test_s_eh_" + testbatch;
    let policy = new io_policy.StatementPolicy(name);
    policy
      .withEnabled(false)
      .withPosition(20)
      .withEnabled(false)
      .withAction(io_policy.POLICY_ACTIONS.ALLOW)
      .withRuleType(io_policy.POLICY_RULE_TYPE.WHEN)
      .withRuleSEXP("(REFERENCES-TABLE 'mamori')")
      .withAlert(requestAlert.name)
      .withEventHandler(eventHandlerName);
    let x = await io_utils.noThrow(policy.create(api));
    expect(x).toSucceed();

    //Test select
    let x2 = await io_utils.noThrow(
      io_policy.StatementPolicy.list(api, { description: name }),
    );
    expect(x2.length).toBe(1);

    //Text get by ID
    let x3 = await io_utils.noThrow(
      io_policy.StatementPolicy.get(api, x2[0].id),
    );
    expect(x3.length).toBe(1);
    let x4 = x3[0];
    if (x4.event_handler !== undefined) {
      expect(x4.event_handler).toBe(eventHandlerName);
    }

    //Test delete
    policy.id = x4.id;
    let x5 = await io_utils.noThrow(policy.delete(api));
    expect(x5).toSucceed();

    //Test FROM JSON
    let p2 = io_policy.StatementPolicy.build(x4);
    let x6 = await io_utils.noThrow(p2.create(api));
    expect(x6).toSucceed();
    let x7 = await io_utils.noThrow(
      io_policy.StatementPolicy.list(api, { description: name }),
    );
    expect(x7).toSucceed();
    expect(x7.length).toBe(1);

    let p3 = io_policy.StatementPolicy.build(x7[0]);
    let x8 = await io_utils.noThrow(p3.delete(api));
    expect(x8).toSucceed();
  });

  test("policy 03 - access rule API with event_handler", async () => {
    let name = "test_c_policy_api_eh_" + testbatch;
    const eventHandlerName = "test_api_eh_" + testbatch;

    let cleanit = await io_utils.noThrow(
      io_policy.ConnectionPolicy.listBefore(api, { description: name }),
    );
    if (cleanit.length > 0) {
      let p2 = io_policy.ConnectionPolicy.build(cleanit[0]);
      await io_utils.noThrow(p2.delete(api));
    }

    const clause = {
      action: "Deny",
      format: "sql" as const,
      condition: {
        clause_type: "When",
        clauses: "(SOURCE-IP \"\"127.0.0.1\"\")",
      },
    };
    let createRes = await io_utils.noThrow(
      api.create_access_rule(
        io_policy.POLICY_TYPES.BEFORE_CONNECTION,
        clause,
        25,
        requestAlert.name,
        name,
        false,
        eventHandlerName,
      ),
    );
    expect(createRes).toSucceed();

    let listRes = await io_utils.noThrow(
      io_policy.ConnectionPolicy.listBefore(api, { description: name }),
    );
    expect(listRes.length).toBe(1);
    const ruleId = listRes[0].id;
    if (listRes[0].event_handler !== undefined) {
      expect(listRes[0].event_handler).toBe(eventHandlerName);
    }

    let updateRes = await io_utils.noThrow(
      api.update_access_rule(
        ruleId,
        io_policy.POLICY_TYPES.BEFORE_CONNECTION,
        clause,
        25,
        requestAlert.name,
        name + " updated",
        false,
        eventHandlerName + "_v2",
      ),
    );
    expect(updateRes).toSucceed();

    let listAfter = await io_utils.noThrow(
      io_policy.ConnectionPolicy.listBefore(api, { description: name + " updated" }),
    );
    if (listAfter.length > 0 && listAfter[0].event_handler !== undefined) {
      expect(listAfter[0].event_handler).toBe(eventHandlerName + "_v2");
    }

    await io_utils.noThrow(api.drop_access_rule(ruleId));
  });
});

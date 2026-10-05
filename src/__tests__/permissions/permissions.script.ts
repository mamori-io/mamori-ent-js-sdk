import { MamoriService, io_https, io_utils, io_script, io_script_flow, io_permission, io_requestable_resource, io_role } from '../../api';
import { TIME_UNIT } from '../../permission';
import * as helper from '../../__utility__/test-helper';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe('script execute permission tests', () => {
  let api: MamoriService;
  const scriptName = 'test_script_perm_' + testbatch;
  const flowName = 'test_script_flow_perm_' + testbatch;
  const flowScript = 'test_script_flow_perm_s_' + testbatch;
  const grantee = 'test_script_user_' + testbatch;
  const granteepw = "J{J'vpKsn3213W6(6A,4_vdQ'}D";

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
    await cleanup();

    await io_utils.ignoreError(api.delete_user(grantee));
    await api.create_user({
      username: grantee,
      password: granteepw,
      fullname: grantee,
      identified_by: 'password',
      email: 'test@test.test',
    });

    const script = new io_script.Script(scriptName, 'MAMORI', '')
      .withBody('parameters.out.set("ok", "yes-" + parameters.in.get("x"));')
      .withParameters([
        { name: 'x', direction: 'in', type: 'string', default: 'a' },
        { name: 'ok', direction: 'out', type: 'string' },
      ]);
    expect(await io_utils.noThrow(script.create(api))).toSucceed();

    const s2 = new io_script.Script(flowScript, 'MAMORI', '')
      .withBody('parameters.out.set("ok", "flow");')
      .withParameters([{ name: 'ok', direction: 'out', type: 'string' }]);
    expect(await io_utils.noThrow(s2.create(api))).toSucceed();

    // Hub requireStepId: each step needs a canvas/block id (same shape as CRUD script-flow tests)
    const flowStepId = 'flow_perm_b1_' + testbatch;
    const flow = new io_script_flow.ScriptFlow(flowName, [
      { id: flowStepId, script: flowScript, mappings: {} },
    ]);
    expect(await io_utils.noThrow(flow.create(api))).toSucceed();
  });

  afterAll(async () => {
    await cleanup();
    await io_utils.ignoreError(api.delete_user(grantee));
    await api.logout();
  });

  async function cleanup() {
    const flow = await io_utils.ignoreError(io_script_flow.ScriptFlow.getByName(api, flowName));
    if (flow && flow.id) {
      await io_utils.ignoreError(flow.delete(api));
    }
    for (const name of [scriptName, flowScript]) {
      const s = await io_utils.ignoreError(io_script.Script.getByName(api, name));
      if (s && s.id) {
        await io_utils.ignoreError(s.delete(api));
      }
    }
  }

  test('grant EXECUTE SCRIPT with VALID FOR and run as grantee', async () => {
    // Clear any prior grant without VALID (VALID FOR on REVOKE matches exact timestamps and can miss)
    await io_utils.ignoreError(
      new io_permission.ScriptPermission().resource(scriptName).grantee(grantee).revoke(api),
    );

    const perm = new io_permission.ScriptPermission()
      .resource(scriptName)
      .grantee(grantee)
      .withValidFor(30, TIME_UNIT.MINUTES);

    const granted = await io_utils.noThrow(perm.grant(api));
    expect(granted.errors).toBe(false);

    const userApi = new MamoriService(host, INSECURE);
    await userApi.login(grantee, granteepw);

    const script = new io_script.Script(scriptName);
    const run = await io_utils.noThrow(script.run(userApi, { x: 'user' }));
    expect(run.success).toBe(true);
    expect(run.result.outs.ok).toBe('yes-user');

    // Non-admin SYS.SCRIPTS should include granted script
    const listed = await io_utils.noThrow(io_script.Script.list(userApi));
    expect(Array.isArray(listed)).toBe(true);
    expect(listed.map((r: any) => r.name)).toContain(scriptName);

    await userApi.logout();

    // Revoke without VALID so Hub removes the grant (cascade) rather than matching a new time window
    const revoked = await io_utils.noThrow(
      new io_permission.ScriptPermission().resource(scriptName).grantee(grantee).revoke(api),
    );
    expect(revoked.errors).toBe(false);

    const userApi2 = new MamoriService(host, INSECURE);
    await userApi2.login(grantee, granteepw);
    const denied = await io_utils.noThrow(script.run(userApi2, { x: 'nope' }));
    const deniedOk =
      denied?.errors === true ||
      denied?.success === false ||
      denied?.response != null ||
      (typeof denied?.message === 'string' && denied.message.length > 0);
    expect(deniedOk).toBe(true);
    await userApi2.logout();
  });

  test('grant EXECUTE SCRIPT FLOW and run as grantee', async () => {
    const perm = new io_permission.ScriptFlowPermission()
      .resource(flowName)
      .grantee(grantee);

    await io_utils.ignoreError(perm.revoke(api));
    expect((await io_utils.noThrow(perm.grant(api))).errors).toBe(false);

    const userApi = new MamoriService(host, INSECURE);
    await userApi.login(grantee, granteepw);

    const flow = new io_script_flow.ScriptFlow(flowName);
    const run = await io_utils.noThrow(flow.run(userApi, {}));
    expect(run.success).toBe(true);

    await userApi.logout();
    expect((await io_utils.noThrow(perm.revoke(api))).errors).toBe(false);
  });

  test('MSQL GRANT EXECUTE SCRIPT ON syntax', async () => {
    const sql =
      "GRANT EXECUTE SCRIPT ON \"" +
      scriptName +
      "\" TO \"" +
      grantee +
      "\" VALID FOR 15 MINUTES";
    const r = await io_utils.noThrow(api.select(sql));
    expect(r.errors).not.toBe(true);

    const revokeSql =
      "REVOKE EXECUTE SCRIPT ON \"" + scriptName + "\" FROM \"" + grantee + "\"";
    const r2 = await io_utils.noThrow(api.select(revokeSql));
    expect(r2.errors).not.toBe(true);
  });

  test('script requestable create/delete', async () => {
    const policyName = 'test_script_rsc_policy_' + testbatch;
    const endorsementRole = 'test_role_for_' + policyName;
    const policy = await helper.Policy.setupResourcePolicy(api, endorsementRole, policyName);

    const requestable = new io_requestable_resource.RequestableResource(
      io_requestable_resource.REQUEST_RESOURCE_TYPE.SCRIPT,
    )
      .withResource(scriptName)
      .withGrantee(grantee)
      .withPolicy(policyName);

    await io_utils.noThrow(
      io_requestable_resource.RequestableResource.deleteByName(
        api,
        requestable.resource_type,
        grantee,
        scriptName,
        policyName,
      ),
    );

    const r1 = await io_utils.noThrow(requestable.create(api));
    expect(r1).toSucceed();

    const r2 = await io_utils.noThrow(
      io_requestable_resource.RequestableResource.getByName(
        api,
        requestable.resource_type,
        grantee,
        scriptName,
        policyName,
      ),
    );
    expect(r2.id).toBeDefined();

    await io_utils.noThrow(r2.delete(api));
    await io_utils.noThrow(policy.delete(api));
    await io_utils.ignoreError(new io_role.Role(endorsementRole).delete(api));
  });
});

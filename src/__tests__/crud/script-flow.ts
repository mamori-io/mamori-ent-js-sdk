import { MamoriService, io_https, io_utils, io_script, io_script_flow } from '../../api';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe('script flow CRUD and execute', () => {
  let api: MamoriService;
  const flowName = 'test_script_flow_' + testbatch;
  const s1 = 'test_flow_s1_' + testbatch;
  const s2 = 'test_flow_s2_' + testbatch;
  const s3 = 'test_flow_s3_' + testbatch;
  const loopFlow = 'test_script_flow_loop_' + testbatch;

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await api.logout();
  });

  async function deleteScript(name: string) {
    const existing = await io_utils.ignoreError(io_script.Script.getByName(api, name));
    if (existing && existing.id) {
      await io_utils.ignoreError(existing.delete(api));
    }
  }

  async function deleteFlow(name: string) {
    const existing = await io_utils.ignoreError(io_script_flow.ScriptFlow.getByName(api, name));
    if (existing && existing.id) {
      await io_utils.ignoreError(existing.delete(api));
    }
  }

  async function cleanup() {
    await deleteFlow(flowName);
    await deleteFlow(loopFlow);
    await deleteScript(s1);
    await deleteScript(s2);
    await deleteScript(s3);
  }

  test('scalar mapping between two mamori scripts by block id', async () => {
    const script1 = new io_script.Script(s1, 'MAMORI', '')
      .withBody('parameters.out.set("ticket", parameters.in.get("ticket_id") + "-ok");')
      .withParameters([
        { name: 'ticket_id', direction: 'in', type: 'string' },
        { name: 'ticket', direction: 'out', type: 'string' },
      ]);
    const script2 = new io_script.Script(s2, 'MAMORI', '')
      .withBody('parameters.out.set("final", "done:" + parameters.in.get("ticket"));')
      .withParameters([
        { name: 'ticket', direction: 'in', type: 'string' },
        { name: 'final', direction: 'out', type: 'string' },
      ]);

    expect(await io_utils.noThrow(script1.create(api))).toSucceed();
    expect(await io_utils.noThrow(script2.create(api))).toSucceed();

    const id1 = 'b1_' + testbatch;
    const id2 = 'b2_' + testbatch;
    const flow = new io_script_flow.ScriptFlow(flowName, [
      {
        id: id1,
        script: s1,
        mappings: {},
      },
      {
        id: id2,
        script: s2,
        mappings: { ticket: { from: id1, name: 'ticket' } },
      },
    ]);

    expect(await io_utils.noThrow(flow.create(api))).toSucceed();
    expect(flow.id).toBeTruthy();

    const stored = await io_utils.noThrow(io_script_flow.ScriptFlow.getByName(api, flowName));
    expect(stored).toBeTruthy();
    expect(stored!.steps.length).toBe(2);
    expect(stored!.steps[0].script).toBe(s1);

    // Empty mappings on start merge flowInputs by name (ticket_id)
    const run = await io_utils.noThrow(flow.run(api, { ticket_id: 'TK-1' }));
    expect(run.success).toBe(true);
    expect(run.result.outs.final).toBe('done:TK-1-ok');
    expect(run.result.steps.length).toBe(2);

    expect(await io_utils.noThrow(flow.delete(api))).toSucceed();
    expect(await io_utils.noThrow(script2.delete(api))).toSucceed();
    expect(await io_utils.noThrow(script1.delete(api))).toSucceed();
  });

  test('loop iterates json_array with ROW mapping', async () => {
    const producer = new io_script.Script(s1, 'MAMORI', '')
      .withBody(
        'parameters.out.set("users", [{id:1,email:"one@ex.com"},{id:2,email:"two@ex.com"}]);',
      )
      .withParameters([{ name: 'users', direction: 'out', type: 'json_array' }]);

    const consumer = new io_script.Script(s3, 'MAMORI', '')
      .withBody(
        'var row = parameters.in.get("row"); parameters.out.set("msg", "mail:" + row.email);',
      )
      .withParameters([
        { name: 'row', direction: 'in', type: 'json_array' },
        { name: 'msg', direction: 'out', type: 'string' },
      ]);

    expect(await io_utils.noThrow(producer.create(api))).toSucceed();
    expect(await io_utils.noThrow(consumer.create(api))).toSucceed();

    const prodId = 'prod_' + testbatch;
    const loopId = 'loop_' + testbatch;
    const childId = 'child_' + testbatch;
    const flow = new io_script_flow.ScriptFlow(loopFlow, [
      { id: prodId, script: s1, mappings: {} },
      {
        id: loopId,
        type: 'loop',
        name: 'each_user',
        mode: 'serial',
        mappings: { input: { from: prodId, name: 'users' } },
        steps: [
          {
            id: childId,
            script: s3,
            mappings: { row: { from: loopId, name: 'ROW' } },
          },
        ],
      },
    ]);

    expect(await io_utils.noThrow(flow.create(api))).toSucceed();

    const run = await io_utils.noThrow(flow.run(api, {}));
    expect(run.success).toBe(true);
    expect(run.result.steps.length).toBe(2);
    expect(run.result.steps[1].type).toBe('loop');
    expect(run.result.steps[1].iterations.length).toBe(2);
    expect(run.result.steps[1].iterations[0].results[0].outs.msg).toBe('mail:one@ex.com');
    expect(run.result.steps[1].iterations[1].results[0].outs.msg).toBe('mail:two@ex.com');

    expect(await io_utils.noThrow(flow.delete(api))).toSucceed();
    expect(await io_utils.noThrow(consumer.delete(api))).toSucceed();
    expect(await io_utils.noThrow(producer.delete(api))).toSucceed();
  });
});

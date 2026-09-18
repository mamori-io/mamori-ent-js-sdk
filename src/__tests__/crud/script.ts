import { MamoriService, io_https, io_utils, io_script } from '../../api';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe('script CRUD and execute', () => {
  let api: MamoriService;
  const mamoriName = 'test_script_mamori_' + testbatch;
  const sqlName = 'test_script_sql_' + testbatch;

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
    for (const name of [mamoriName, sqlName]) {
      const existing = await io_utils.ignoreError(io_script.Script.getByName(api, name));
      if (existing && existing.id) {
        await io_utils.ignoreError(existing.delete(api));
      }
    }
  }

  test('mamori script create, run with typed outs, update, delete', async () => {
    const script = new io_script.Script(mamoriName, 'MAMORI', '')
      .withBody(
        'outputs.set("greeting", "hello-" + parameters.get("who"));' +
          'outputs.set("count", Number(parameters.get("n")) + 1);',
      )
      .withParameters([
        { name: 'who', direction: 'in', type: 'string', default: 'world' },
        { name: 'n', direction: 'in', type: 'number', default: 1 },
        { name: 'greeting', direction: 'out', type: 'string' },
        { name: 'count', direction: 'out', type: 'number' },
      ]);

    const created = await io_utils.noThrow(script.create(api));
    expect(created).toSucceed();
    expect(script.id).toBeTruthy();

    const stored = await io_utils.noThrow(io_script.Script.getByName(api, mamoriName));
    expect(stored).toBeTruthy();
    expect(stored!.target_type).toBe('MAMORI');
    expect(stored!.id).toBe(script.id);

    const run = await io_utils.noThrow(script.run(api, { who: 'sdk', n: 4 }));
    expect(run.errors).not.toBe(true);
    expect(run.success).toBe(true);
    expect(run.result.outs.greeting).toBe('hello-sdk');
    expect(Number(run.result.outs.count)).toBe(5);

    script.body = 'outputs.set("greeting", "updated"); outputs.set("count", 99);';
    const updated = await io_utils.noThrow(script.update(api));
    expect(updated).toSucceed();

    const run2 = await io_utils.noThrow(script.run(api, {}));
    expect(run2.success).toBe(true);
    expect(run2.result.outs.greeting).toBe('updated');

    const deleted = await io_utils.noThrow(script.delete(api));
    expect(deleted).toSucceed();

    const after = await io_utils.ignoreError(io_script.Script.getByName(api, mamoriName));
    expect(after).toBeFalsy();
  });

  test('mamori script resultset out', async () => {
    const name = mamoriName + '_rs';
    const existing = await io_utils.ignoreError(io_script.Script.getByName(api, name));
    if (existing && existing.id) {
      await io_utils.ignoreError(existing.delete(api));
    }

    const script = new io_script.Script(name, 'MAMORI', '')
      .withBody(
        'outputs.setRows([{id:1,email:"a@example.com"},{id:2,email:"b@example.com"}]);',
      )
      .withParameters([
        {
          name: 'rows',
          direction: 'out',
          type: 'resultset',
          columns: [
            { name: 'id', type: 'number' },
            { name: 'email', type: 'string' },
          ],
        },
      ]);

    expect(await io_utils.noThrow(script.create(api))).toSucceed();
    const run = await io_utils.noThrow(script.run(api, {}));
    expect(run.success).toBe(true);
    expect(run.result.rows.length).toBe(2);
    expect(run.result.rows[0].email).toBe('a@example.com');
    expect(await io_utils.noThrow(script.delete(api))).toSucceed();
  });

  test('sql script create against missing datasource fails validation', async () => {
    const script = new io_script.Script(sqlName, 'SQL', 'select 1 as n')
      .withTarget('SQL', 'no_such_datasource_zzxxyy')
      .withParameters([{ name: 'n', direction: 'out', type: 'number' }]);

    const created = await io_utils.noThrow(script.create(api));
    expect(created.errors).toBeTruthy();
  });
});

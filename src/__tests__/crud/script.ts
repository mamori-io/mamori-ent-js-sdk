import { MamoriService, io_https, io_utils, io_script, io_tag } from '../../api';
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
        'parameters.out.set("greeting", "hello-" + parameters.in.get("who"));' +
          'parameters.out.set("count", Number(parameters.in.get("n")) + 1);',
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

    script.body = 'parameters.out.set("greeting", "updated"); parameters.out.set("count", 99);';
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

  test('mamori script json_array out', async () => {
    const name = mamoriName + '_arr';
    const existing = await io_utils.ignoreError(io_script.Script.getByName(api, name));
    if (existing && existing.id) {
      await io_utils.ignoreError(existing.delete(api));
    }

    const script = new io_script.Script(name, 'MAMORI', '')
      .withBody(
        'parameters.out.set("rows", [{id:1,email:"a@example.com"},{id:2,email:"b@example.com"}]);',
      )
      .withParameters([{ name: 'rows', direction: 'out', type: 'json_array' }]);

    expect(await io_utils.noThrow(script.create(api))).toSucceed();
    const run = await io_utils.noThrow(script.run(api));
    expect(run.success).toBe(true);
    expect(run.result.outs.rows.length).toBe(2);
    expect(run.result.outs.rows[0].email).toBe('a@example.com');
    expect(await io_utils.noThrow(script.delete(api))).toSucceed();
  });

  test('sql script create against missing datasource fails validation', async () => {
    const script = new io_script.Script(sqlName, 'SQL', 'select 1 as n')
      .withTarget('SQL', 'no_such_datasource_zzxxyy')
      .withParameters([{ name: 'n', direction: 'out', type: 'number' }]);

    const created = await io_utils.noThrow(script.create(api));
    expect(created.errors).toBeTruthy();
  });

  test('script tags - add/remove and cascade on delete', async () => {
    const scriptName = 'test_script_tags_' + testbatch;
    const tagName = 'test_script_tag_' + testbatch;
    const existing = await io_utils.ignoreError(io_script.Script.getByName(api, scriptName));
    if (existing && existing.id) {
      await io_utils.ignoreError(existing.delete(api));
    }
    const existingTag = await io_utils.ignoreError(io_tag.Tag.getByName(api, tagName));
    if (existingTag && existingTag.id) {
      await io_utils.ignoreError(existingTag.delete(api));
    }

    const script = new io_script.Script(scriptName, 'MAMORI', '')
      .withBody('parameters.out.set("ok", true);')
      .withParameters([{ name: 'ok', direction: 'out', type: 'boolean' }]);
    expect(await io_utils.noThrow(script.create(api))).toSucceed();
    expect(script.id).toBeTruthy();

    const tag = new io_tag.Tag(tagName);
    expect(await io_utils.noThrow(tag.create(api))).toSucceed();
    expect(tag.id).toBeTruthy();

    try {
      expect(await io_utils.noThrow(script.addTag(api, tag))).toSucceed();

      let assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
      expect(assignments.errors).not.toBe(true);
      let match = assignments.filter(
        (r: any) =>
          String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'script' &&
          String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === scriptName.toLowerCase(),
      );
      expect(match.length).toBe(1);

      expect(await io_utils.noThrow(script.removeTag(api, tag))).toSucceed();
      assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
      expect(assignments.errors).not.toBe(true);
      match = assignments.filter(
        (r: any) =>
          String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'script' &&
          String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === scriptName.toLowerCase(),
      );
      expect(match.length).toBe(0);

      expect(await io_utils.noThrow(script.addTag(api, tagName))).toSucceed();
      expect(await io_utils.noThrow(script.delete(api))).toSucceed();

      assignments = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
      expect(assignments.errors).not.toBe(true);
      match = assignments.filter(
        (r: any) =>
          String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'script' &&
          String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === scriptName.toLowerCase(),
      );
      expect(match.length).toBe(0);
    } finally {
      const leftover = await io_utils.ignoreError(io_script.Script.getByName(api, scriptName));
      if (leftover && leftover.id) {
        await io_utils.ignoreError(leftover.delete(api));
      }
      await io_utils.ignoreError(tag.delete(api));
    }
  });
});

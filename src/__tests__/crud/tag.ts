import { MamoriService, io_https, io_utils, io_tag } from '../../api';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe('tag CRUD', () => {
  let api: MamoriService;
  const tagName = 'test_tag_' + testbatch;
  const tagName2 = 'test_tag_renamed_' + testbatch;
  const tagNameColor = 'test_tag_color_' + testbatch;
  const tagNameAutoA = 'test_tag_auto_a_' + testbatch;
  const tagNameAutoB = 'test_tag_auto_b_' + testbatch;

  const fixtureNames = [tagName, tagName2, tagNameColor, tagNameAutoA, tagNameAutoB];

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
  });

  afterAll(async () => {
    await cleanup();
    await api.logout();
  });

  /** Delete any leftover fixtures this suite creates (failed prior runs leave dirty state). */
  async function cleanup() {
    for (const name of fixtureNames) {
      const existing = await io_utils.ignoreError(io_tag.Tag.getByName(api, name));
      if (existing && existing.id) {
        await io_utils.ignoreError(existing.delete(api));
      }
      await io_utils.ignoreError(api.call('DELETE_TAG_BY_NAME', name));
    }
  }

  test('create without options assigns unique color', async () => {
    await cleanup();

    const tag = new io_tag.Tag(tagName);
    const created = await io_utils.noThrow(tag.create(api));
    expect(created).toSucceed();
    expect(tag.id).toBeTruthy();
    expect(tag.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(String(tag.tag_kind || '').toUpperCase()).toBe('CUSTOM');

    const stored = await io_utils.noThrow(io_tag.Tag.getByName(api, tagName));
    expect(stored).toBeTruthy();
    expect(stored!.id).toBe(tag.id);
    expect(stored!.name).toBe(tagName);
    expect(String(stored!.color).toUpperCase()).toBe(String(tag.color).toUpperCase());
    expect(String(stored!.tag_kind || '').toUpperCase()).toBe('CUSTOM');

    // Second auto-colored tag should get a different color while palette slots remain.
    const other = new io_tag.Tag(tagNameAutoA);
    expect(await io_utils.noThrow(other.create(api))).toSucceed();
    expect(other.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(String(other.color).toUpperCase()).not.toBe(String(tag.color).toUpperCase());

    await io_utils.ignoreError(other.delete(api));
    await io_utils.ignoreError(tag.delete(api));
  });

  test('create with color in options uses that color (single ADD_TAG)', async () => {
    await cleanup();

    const chosen = '#AABBCC';
    const tag = new io_tag.Tag(tagNameColor, chosen);
    const created = await io_utils.noThrow(tag.create(api));
    expect(created).toSucceed();
    expect(tag.id).toBeTruthy();
    expect(String(tag.color).toUpperCase()).toBe(chosen);

    // Raw CALL with options JSON (same contract as SDK)
    const rawName = tagNameAutoB;
    const raw = await io_utils.noThrow(
      api.call('ADD_TAG', rawName, JSON.stringify({ color: '#112233' })),
    );
    expect(raw).toSucceed();
    const byName = await io_utils.noThrow(io_tag.Tag.getByName(api, rawName));
    expect(byName).toBeTruthy();
    expect(String(byName!.color).toUpperCase()).toBe('#112233');

    await io_utils.ignoreError(tag.delete(api));
    if (byName && byName.id) {
      await io_utils.ignoreError(byName.delete(api));
    }
  });

  test('update color/name, delete', async () => {
    await cleanup();

    const tag = new io_tag.Tag(tagName);
    expect(await io_utils.noThrow(tag.create(api))).toSucceed();

    const newColor = '#112233';
    const updatedColor = await io_utils.noThrow(tag.update(api, null, newColor));
    expect(updatedColor).toSucceed();
    expect(String(tag.color).toUpperCase()).toBe(newColor);

    const afterColor = await io_utils.noThrow(io_tag.Tag.getById(api, tag.id!));
    expect(String(afterColor!.color).toUpperCase()).toBe(newColor);
    expect(afterColor!.name).toBe(tagName);

    const updatedName = await io_utils.noThrow(tag.update(api, tagName2, null));
    expect(updatedName).toSucceed();
    expect(tag.name).toBe(tagName2);

    const afterName = await io_utils.noThrow(io_tag.Tag.getByName(api, tagName2));
    expect(afterName).toBeTruthy();
    expect(afterName!.id).toBe(tag.id);

    const deleted = await io_utils.noThrow(tag.delete(api));
    expect(deleted).toSucceed();

    const gone = await io_utils.ignoreError(io_tag.Tag.getByName(api, tagName2));
    expect(gone).toBeFalsy();
  });

  test('delete cascades resource tag assignments', async () => {
    await cleanup();

    const tag = new io_tag.Tag(tagName);
    expect(await io_utils.noThrow(tag.create(api))).toSucceed();
    expect(tag.id).toBeTruthy();

    const assigned = await io_utils.noThrow(tag.assign(api, 'user', username));
    expect(assigned).toSucceed();

    const before = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
    expect(before.errors).not.toBe(true);
    expect(before.length).toBeGreaterThanOrEqual(1);
    const match = before.filter(
      (r: any) =>
        String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'user' &&
        String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === username.toLowerCase(),
    );
    expect(match.length).toBe(1);

    const deleted = await io_utils.noThrow(tag.delete(api));
    expect(deleted).toSucceed();

    const afterTag = await io_utils.ignoreError(io_tag.Tag.getById(api, tag.id!));
    expect(afterTag).toBeFalsy();

    const afterAssign = await io_utils.noThrow(io_tag.Tag.listAssignments(api, tag.id));
    expect(afterAssign.errors).not.toBe(true);
    expect(afterAssign.length).toBe(0);
  });

  test('delete by name', async () => {
    await cleanup();

    const tag = new io_tag.Tag(tagName);
    expect(await io_utils.noThrow(tag.create(api))).toSucceed();

    const deleted = await io_utils.noThrow(tag.deleteByName(api));
    expect(deleted).toSucceed();

    const gone = await io_utils.ignoreError(io_tag.Tag.getByName(api, tagName));
    expect(gone).toBeFalsy();
  });

  test('SYSTEM tags: seeded, recolor ok, rename/delete rejected', async () => {
    const systemNames = ['sensitive', 'critical', 'production', 'test', 'development'];
    for (const name of systemNames) {
      const tag = await io_utils.noThrow(io_tag.Tag.getByName(api, name));
      expect(tag).toBeTruthy();
      expect(String(tag!.tag_kind || '').toUpperCase()).toBe('SYSTEM');
      expect(tag!.id).toBeTruthy();
    }

    const system = await io_tag.Tag.getByName(api, 'sensitive');
    expect(system).toBeTruthy();
    const originalColor = String(system!.color || '').toUpperCase();
    const recolorTo = originalColor === '#E57373' ? '#AB47BC' : '#E57373';

    const recolored = await io_utils.noThrow(system!.update(api, null, recolorTo));
    expect(recolored).toSucceed();
    expect(String(system!.color).toUpperCase()).toBe(recolorTo);

    // restore seed color
    const restored = await io_utils.noThrow(system!.update(api, null, originalColor || '#E57373'));
    expect(restored).toSucceed();

    // SDK suppresses rename for SYSTEM; exercise Hub enforcement via CALL.
    const rename = await io_utils.noThrow(
      api.call('UPDATE_TAG', system!.id, 'sensitive_renamed_' + testbatch, null),
    );
    expect(rename.errors).toBe(true);

    const afterRename = await io_utils.noThrow(io_tag.Tag.getByName(api, 'sensitive'));
    expect(afterRename).toBeTruthy();
    expect(afterRename!.name).toBe('sensitive');

    const deleted = await io_utils.noThrow(system!.delete(api));
    expect(deleted.errors).toBe(true);

    const stillThere = await io_utils.noThrow(io_tag.Tag.getByName(api, 'sensitive'));
    expect(stillThere).toBeTruthy();
  });
});

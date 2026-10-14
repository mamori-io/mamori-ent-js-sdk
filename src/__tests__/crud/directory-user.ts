/**
 * Directory user CRUD (ch10588: create does not assign MFA).
 *
 * Pattern: admin session only for directory lifecycle + SYS.USER_AUTHENTICATION_PROVIDERS.
 * Subject login is out of scope here (see api.replace-device-token / api.mfa-apply).
 *
 * Env: MAMORI_LDAP_PROVIDER, MAMORI_LDAP_USER (+ admin MAMORI_*)
 */
import { MamoriService } from "../../api";
import { DirectoryUser } from "../../user";
import { Tag } from "../../tag";
import { noThrow, ignoreError } from "../../utils";
import {
  INSECURE_HTTPS,
  assertOperationOk,
  authProviderRows,
  col,
} from "../../__utility__/auth-test-harness";
import "../../__utility__/jest/error_matcher";

const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const directoryProvider = process.env.MAMORI_LDAP_PROVIDER || "";
const directoryUsername = process.env.MAMORI_LDAP_USER || "";
const testbatch = process.env.MAMORI_TEST_BATCH || String(Date.now());

const directoryTest =
  directoryProvider && directoryUsername ? test : test.skip;

describe("directory user tests", () => {
  let api: MamoriService;

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE_HTTPS);
    await api.login(username, password);
  });

  afterAll(async () => {
    await api.logout();
  });

  directoryTest("directory user 01 - disable enable unlock", async () => {
    const k = new DirectoryUser(directoryProvider, directoryUsername);
    await ignoreError(k.delete(api));

    const createResult = await noThrow(k.create(api));
    assertOperationOk("directory create", createResult);

    const disableResult = await noThrow(k.disableAccount(api));
    assertOperationOk("directory disable", disableResult);

    const enableResult = await noThrow(k.enableAccount(api));
    assertOperationOk("directory enable", enableResult);

    const unlockResult = await noThrow(k.unlockAccount(api));
    assertOperationOk("directory unlock", unlockResult);

    const deleteResult = await noThrow(k.delete(api));
    assertOperationOk("directory delete", deleteResult);
  });

  directoryTest("directory user create does not assign MFA providers", async () => {
    const k = new DirectoryUser(directoryProvider, directoryUsername);
    await ignoreError(k.delete(api));
    try {
      assertOperationOk("directory create (mfa check)", await noThrow(k.create(api)));

      const list = await authProviderRows(api, directoryUsername);
      const mfaScoped = list.filter((r) => {
        const provider = String(col(r, "provider_name") || "").toLowerCase();
        const apply = String(col(r, "mfa_apply") || "").trim();
        return provider !== "password" && apply.length > 0;
      });
      expect(mfaScoped.length).toBe(0);
    } finally {
      await ignoreError(k.delete(api));
    }
  });

  directoryTest("directory user tags - add/remove (delete does not cascade)", async () => {
    const k = new DirectoryUser(directoryProvider, directoryUsername);
    const tagName = "test_dir_user_tag_" + testbatch;
    await ignoreError(k.delete(api));
    const existingTag = await ignoreError(Tag.getByName(api, tagName));
    if (existingTag && existingTag.id) {
      await ignoreError(existingTag.delete(api));
    }

    assertOperationOk("directory create (tags)", await noThrow(k.create(api)));
    const tag = new Tag(tagName);
    expect(await noThrow(tag.create(api))).toSucceed();
    expect(tag.id).toBeTruthy();

    try {
      expect(await noThrow(k.addTag(api, tag))).toSucceed();

      let assignments = await noThrow(Tag.listAssignments(api, tag.id));
      expect(assignments.errors).not.toBe(true);
      let match = assignments.filter(
        (r: any) =>
          String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === "user" &&
          String(r.resource_key || r.RESOURCE_KEY).toLowerCase() ===
            directoryUsername.toLowerCase(),
      );
      expect(match.length).toBe(1);

      expect(await noThrow(k.removeTag(api, tag))).toSucceed();
      assignments = await noThrow(Tag.listAssignments(api, tag.id));
      expect(assignments.errors).not.toBe(true);
      match = assignments.filter(
        (r: any) =>
          String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === "user" &&
          String(r.resource_key || r.RESOURCE_KEY).toLowerCase() ===
            directoryUsername.toLowerCase(),
      );
      expect(match.length).toBe(0);

      expect(await noThrow(k.addTag(api, tagName))).toSucceed();
      // Directory delete does not cascade user_tags; clear before delete.
      expect(await noThrow(k.removeTag(api, tag))).toSucceed();
      assertOperationOk("directory delete (tags)", await noThrow(k.delete(api)));

      assignments = await noThrow(Tag.listAssignments(api, tag.id));
      expect(assignments.errors).not.toBe(true);
      match = assignments.filter(
        (r: any) =>
          String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === "user" &&
          String(r.resource_key || r.RESOURCE_KEY).toLowerCase() ===
            directoryUsername.toLowerCase(),
      );
      expect(match.length).toBe(0);
    } finally {
      await ignoreError(k.delete(api));
      await ignoreError(tag.delete(api));
    }
  });
});

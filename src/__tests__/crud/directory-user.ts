/**
 * Directory user CRUD (ch10588: create does not assign MFA).
 *
 * Pattern: admin session only for directory lifecycle + SYS.USER_AUTHENTICATION_PROVIDERS.
 * Subject login is out of scope here (see api.replace-device-token / api.mfa-apply).
 *
 * Env: MAMORI_DIRECTORY_PROVIDER, MAMORI_DIRECTORY_USERNAME (+ admin MAMORI_*)
 */
import { MamoriService } from "../../api";
import { DirectoryUser } from "../../user";
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
const directoryProvider = process.env.MAMORI_DIRECTORY_PROVIDER || "";
const directoryUsername = process.env.MAMORI_DIRECTORY_USERNAME || "";

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
});

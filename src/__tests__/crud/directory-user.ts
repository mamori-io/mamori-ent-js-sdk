import { MamoriService } from "../../api";
import * as https from "https";
import { DirectoryUser } from "../../user";
import { noThrow, ignoreError } from "../../utils";
import "../../__utility__/jest/error_matcher";

const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const directoryProvider = process.env.MAMORI_DIRECTORY_PROVIDER || "";
const directoryUsername = process.env.MAMORI_DIRECTORY_USERNAME || "";

const INSECURE = new https.Agent({ rejectUnauthorized: false });
const directoryTest =
  directoryProvider && directoryUsername ? test : test.skip;

describe("directory user tests", () => {
  let api: MamoriService;

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
  });

  afterAll(async () => {
    await api.logout();
  });

  directoryTest("directory user 01 - disable enable unlock", async () => {
    const k = new DirectoryUser(directoryProvider, directoryUsername);
    await ignoreError(k.delete(api));

    const createResult = await noThrow(k.create(api));
    expect(createResult).toSucceed();

    const disableResult = await noThrow(k.disableAccount(api));
    expect(disableResult).toSucceed();

    const enableResult = await noThrow(k.enableAccount(api));
    expect(enableResult).toSucceed();

    const unlockResult = await noThrow(k.unlockAccount(api));
    expect(unlockResult).toSucceed();

    const deleteResult = await noThrow(k.delete(api));
    expect(deleteResult).toSucceed();
  });
});

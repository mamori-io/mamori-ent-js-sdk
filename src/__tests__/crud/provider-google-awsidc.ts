import {
  MamoriService,
  io_https,
  io_utils,
  io_user,
} from "../../api";
import {
  createProviderAsserted,
  dropProviderIgnore,
  getProviderAsserted,
  googleCredentialsFromEnv,
  googleProviderCreateBody,
  googleValidateReady,
  validateProviderAsserted,
} from "../../__utility__/oauth-directory-provider-harness";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";

const awsidcIssuer =
  process.env.MAMORI_AWSIDC_ISSUER ||
  "https://identitycenter.amazonaws.com/ssoins-test";
const awsidcClientId =
  process.env.MAMORI_AWSIDC_CLIENT_ID || "test-awsidc-client-id";
const awsidcLive = !!process.env.MAMORI_AWSIDC_ISSUER;

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });
const describeIf = host && username && password ? describe : describe.skip;

describeIf("Google / AWS IDC authentication providers", () => {
  let api: MamoriService;
  const googleCreds = googleCredentialsFromEnv();
  const googleName = googleCreds.providerName || "test_google_" + testbatch;
  const awsidcName = "test_awsidc_" + testbatch;

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
    await dropProviderIgnore(api, googleName);
    await io_utils.ignoreError(api.drop_provider(awsidcName));
  });

  afterAll(async () => {
    await dropProviderIgnore(api, googleName);
    await io_utils.ignoreError(api.drop_provider(awsidcName));
    await api.logout();
  });

  test("google provider create / get / drop", async () => {
    await createProviderAsserted(api, googleProviderCreateBody(googleName));

    const got = await getProviderAsserted(api, googleName);
    const type = got.provider_type || got.type;
    expect(String(type).toLowerCase()).toBe("google");

    const dropped = await io_utils.noThrow(api.drop_provider(googleName));
    expect(dropped.errors).toBeFalsy();
  });

  const validateTest = googleValidateReady() ? test : test.skip;
  validateTest(
    "google provider validate (requires domain + admin_email + SA JSON)",
    async () => {
      await dropProviderIgnore(api, googleName);
      await createProviderAsserted(api, googleProviderCreateBody(googleName));
      await validateProviderAsserted(api, googleName);
      await dropProviderIgnore(api, googleName);
    },
  );

  test("awsidc provider add / get / drop", async () => {
    const created = await io_utils.noThrow(
      api.add_provider({
        name: awsidcName,
        type: io_user.MFA_PROVIDER.AWSIDC,
        issuer: awsidcIssuer,
        client_id: awsidcClientId,
        client_secret: process.env.MAMORI_AWSIDC_CLIENT_SECRET || "test-secret",
        region: process.env.MAMORI_AWSIDC_REGION || "us-east-1",
        identity_store_id: process.env.MAMORI_AWSIDC_IDENTITY_STORE_ID || "",
        message: "Sign in with AWS",
      }),
    );
    expect(created.errors).toBeFalsy();

    const got = await io_utils.noThrow(api.get_provider(awsidcName));
    expect(got.errors).toBeFalsy();
    const type = got.provider_type || got.type;
    expect(String(type).toLowerCase()).toBe("awsidc");

    if (awsidcLive) {
      const validated = await io_utils.noThrow(
        api.validate_auth_provider(awsidcName),
      );
      expect(validated.errors).toBeFalsy();
    }

    const dropped = await io_utils.noThrow(api.drop_provider(awsidcName));
    expect(dropped.errors).toBeFalsy();
  });
});

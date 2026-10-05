import {
  MamoriService,
  io_https,
  io_utils,
  io_user,
  io_role,
  io_permission,
  io_ondemandpolicies,
  io_requestable_resource,
  io_datasource,
} from "../../api";
import { selectQuery } from "../../__utility__/test-helper";
import "../../__utility__/jest/error_matcher";

const testbatch = process.env.MAMORI_TEST_BATCH || "";
const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";
const dbPassword = process.env.MAMORI_DB_PASSWORD || "";
const dbHost = process.env.MAMORI_DB_HOST || "localhost";
const dbPort = process.env.MAMORI_DB_PORT || "54321";

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

/** Skip when no DB password — datasource requestable needs a real DS. */
const dbtest = dbPassword ? test : test.skip;

function uniqueSuffix(): string {
  return (
    String(testbatch) +
    "_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2, 8)
  ).replace(/[^a-zA-Z0-9_]/g, "_");
}

function col(row: any, name: string): any {
  if (!row) {
    return undefined;
  }
  if (row[name] !== undefined) {
    return row[name];
  }
  const upper = name.toUpperCase();
  if (row[upper] !== undefined) {
    return row[upper];
  }
  const lower = name.toLowerCase();
  if (row[lower] !== undefined) {
    return row[lower];
  }
  return undefined;
}

function sqlQuote(value: string): string {
  return "'" + io_utils.sqlEscape(value) + "'";
}

/**
 * Confirms a non-admin who only reaches a resource policy via a requestable
 * (and does NOT hold the policy request_role) can still see:
 * SYS.PROCEDURE_PARAMETERS, SYS.PROCEDURE_OPTIONS, SYS.ALL_PROCEDURES.
 */
describe("policy requestable catalog visibility", () => {
  let api: MamoriService;
  let apiUser: MamoriService;

  const uid = uniqueSuffix();
  const policyName = "test_pol_reqcat_" + uid;
  const requestRole = "test_pol_reqcat_req_" + uid;
  const endorseRole = "test_pol_reqcat_end_" + uid;
  const grantee = ("test_pol_reqcat_u_" + uid).toLowerCase();
  const granteepw = "J{J'vpKs!$nas!23(6A,4!98712_vdQ'}D";
  const dsName = "test_ds_reqcat_" + uid;
  const paramName = "reason_note";
  const paramDescription = "Reason for access";

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(username, password);
  });

  afterAll(async () => {
    if (apiUser) {
      await io_utils.ignoreError(apiUser.logout());
    }
    if (api) {
      await api.logout();
    }
  });

  dbtest(
    "non-admin via requestable sees procedure parameters/options/all_procedures",
    async () => {
      try {
        await cleanupAdmin();

        // 0. Non-admin user (no request_role grant)
        let user = new io_user.User(grantee)
          .withEmail(grantee + "@ace.com")
          .withFullName("Requestable Catalog User");
        await io_utils.ignoreError(user.delete(api));
        expect(await io_utils.noThrow(user.create(api, granteepw))).toSucceed();

        // Grant REQUEST directly to the user (not via request_role) so they are a requester.
        expect(
          await io_utils.noThrow(
            new io_permission.MamoriPermission([
              io_permission.MAMORI_PERMISSION.REQUEST,
            ])
              .grantee(grantee)
              .grant(api)
          )
        ).toSucceed();

        // 1. Request role + endorse role (user does NOT get requestRole)
        await io_utils.ignoreError(new io_role.Role(requestRole).delete(api));
        await io_utils.ignoreError(new io_role.Role(endorseRole).delete(api));
        expect(await io_utils.noThrow(new io_role.Role(requestRole).create(api))).toSucceed();
        expect(await io_utils.noThrow(new io_role.Role(endorseRole).create(api))).toSucceed();

        // 2. Resource policy with non-empty request_role + text parameter
        let policy = new io_ondemandpolicies.OnDemandPolicy(
          policyName,
          io_ondemandpolicies.POLICY_TYPES.RESOURCE
        );
        policy.request_role = requestRole;
        policy.requires = endorseRole;
        policy.description = "requestable catalog visibility " + uid;
        policy.addParameter(paramName, paramDescription, "", "string");
        policy.withScript([
          "GRANT :privileges ON :resource_name TO :applicant VALID for 15 minutes;",
        ]);
        expect(await io_utils.noThrow(policy.create(api))).toSucceed();

        // Datasource for the requestable
        let ds = new io_datasource.Datasource(dsName);
        await io_utils.ignoreError(ds.delete(api));
        ds.ofType("POSTGRESQL", "postgres")
          .at(dbHost, Number(dbPort))
          .withCredentials("postgres", dbPassword)
          .withDatabase("mamorisys")
          .withConnectionProperties("allowEncodingChanges=true;defaultNchar=true");
        let dsCreate = await io_utils.noThrow(ds.create(api));
        expect(dsCreate).toSucceed();

        // 3. Requestable for datasource → policy → non-admin user
        let requestable = new io_requestable_resource.RequestableResource(
          io_requestable_resource.REQUEST_RESOURCE_TYPE.DATASOURCE
        )
          .withResource(dsName)
          .withLogin("postgres")
          .withGrantee(grantee)
          .withPolicy(policyName)
          .withPrivileges("CREDENTIAL USAGE");

        await io_utils.ignoreError(
          io_requestable_resource.RequestableResource.deleteByName(
            api,
            requestable.resource_type,
            grantee,
            dsName,
            policyName,
            requestable.resource_login
          )
        );
        expect(await io_utils.noThrow(requestable.create(api))).toSucceed();

        // 4. Login as non-admin (does not hold request_role)
        apiUser = new MamoriService(host, INSECURE);
        await apiUser.login(grantee, granteepw);

        // Sanity: user must not hold the policy request_role
        let roles = await selectQuery(
          apiUser,
          "SELECT role_name FROM SYS.USER_ROLES WHERE lower(username)=lower(" +
            sqlQuote(grantee) +
            ")"
        );
        expect(roles.errors).not.toBe(true);
        const roleNames = (Array.isArray(roles) ? roles : []).map((r: any) =>
          String(col(r, "role_name") || "").toLowerCase()
        );
        expect(roleNames).not.toContain(requestRole.toLowerCase());

        // 5a. ALL_PROCEDURES
        let procedures = await selectQuery(
          apiUser,
          "SELECT id, name FROM SYS.ALL_PROCEDURES WHERE lower(name)=lower(" +
            sqlQuote(policyName) +
            ")"
        );
        expect(procedures.errors).not.toBe(true);
        expect(procedures.length).toBeGreaterThan(0);
        const procedureId = Number(col(procedures[0], "id"));
        expect(procedureId).toBeGreaterThan(0);

        // 5b. PROCEDURE_PARAMETERS — must include the text parameter
        let parameters = await selectQuery(
          apiUser,
          "SELECT name, description, data_type FROM SYS.PROCEDURE_PARAMETERS WHERE procedure_id=" +
            procedureId +
            " ORDER BY position"
        );
        expect(parameters.errors).not.toBe(true);
        expect(parameters.length).toBeGreaterThan(0);
        const paramNames = parameters.map((r: any) =>
          String(col(r, "name")).toLowerCase()
        );
        expect(paramNames).toContain(paramName.toLowerCase());

        // 5c. PROCEDURE_OPTIONS
        let options = await selectQuery(
          apiUser,
          "SELECT name, value FROM SYS.PROCEDURE_OPTIONS WHERE procedure_id=" + procedureId
        );
        expect(options.errors).not.toBe(true);
        expect(options.length).toBeGreaterThan(0);
        const optionNames = options.map((r: any) =>
          String(col(r, "name")).toLowerCase()
        );
        expect(optionNames).toContain("request_role");
      } finally {
        if (apiUser) {
          await io_utils.ignoreError(apiUser.logout());
          apiUser = undefined as any;
        }
        await cleanupAdmin();
      }
    }
  );

  async function cleanupAdmin() {
    await io_utils.ignoreError(
      io_requestable_resource.RequestableResource.deleteByName(
        api,
        io_requestable_resource.REQUEST_RESOURCE_TYPE.DATASOURCE,
        grantee,
        dsName,
        policyName,
        "postgres"
      )
    );
    await io_utils.ignoreError(new io_ondemandpolicies.OnDemandPolicy(policyName).delete(api));
    await io_utils.ignoreError(new io_datasource.Datasource(dsName).delete(api));
    await io_utils.ignoreError(new io_user.User(grantee).delete(api));
    await io_utils.ignoreError(new io_role.Role(requestRole).delete(api));
    await io_utils.ignoreError(new io_role.Role(endorseRole).delete(api));
  }
});

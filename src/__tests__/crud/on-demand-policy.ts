import { MamoriService } from '../../api';
import { io_alertchannel, io_role, io_user, io_utils, io_permission, io_ondemandpolicies, io_https } from '../../api';
import '../../__utility__/jest/error_matcher';


const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new io_https.Agent({ rejectUnauthorized: false });

describe("on-demand policy crud tests", () => {

    let api: MamoriService;
    let apiAsAgent: MamoriService;
    let apiAsAPIUser: MamoriService;
    let requestRole = "test_policy_user_role" + testbatch;
    let agentRole = "test_policy_agent_role" + testbatch;

    let agent = "test_o_d_policy_agent." + testbatch;
    let agentpw = "J{J'vpKs!$nas!23(6A,Jjkj#lkj3lkkjQ'}D"

    let grantee = "test_o_d_policy_user." + testbatch;
    let granteepw = "J{J'vpKs!$nas!23(6A,4!98712_vdQ'}D"

    let requestAlert = new io_alertchannel.AlertChannel("test_policy_request_alert" + testbatch);
    let endorseAlert = new io_alertchannel.AlertChannel("test_policy_endorse_alert" + testbatch);

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        requestAlert.addEmailAlert("omasri@mamori.io,test@mamori.io", "request alert", "REQUEST BODY");
        endorseAlert.addEmailAlert("omasri@mamori.io,test@mamori.io", "endorse alert", "REQUEST BODY");
        endorseAlert.addPushNotificationAlert("{{applicant}}", "Endorse Alert");

        let r = await io_utils.noThrow(requestAlert.create(api));
        if (r && r.id) {
            requestAlert.id = r.id;
        }
        let r2 = await io_utils.noThrow(endorseAlert.create(api));
        if (r2 && r2.id) {
            endorseAlert.id = r2.id;
        }

        //Agent
        let agentU = new io_user.User(agent).withEmail(agent + "@ace.com").withFullName("Agent User");
        await io_utils.ignoreError(agentU.delete(api));
        let res = await io_utils.noThrow(agentU.create(api, agentpw));
        expect(res).toSucceed();


        //Policy User
        let policyU = new io_user.User(grantee).withEmail(agent + "@ace.com").withFullName("Policy User");
        await io_utils.ignoreError(policyU.delete(api));
        let res2 = await io_utils.noThrow(policyU.create(api, granteepw));
        expect(res2).toSucceed();
 

        //create roles
        await io_utils.ignoreError(new io_role.Role(agentRole).delete(api));
        await io_utils.ignoreError(new io_role.Role(requestRole).delete(api));
        await io_utils.ignoreError(new io_role.Role(agentRole).create(api));
        await io_utils.ignoreError(new io_role.Role(requestRole).create(api));
        //grant request permission to user role
        await io_utils.ignoreError(new io_permission.MamoriPermission([io_permission.MAMORI_PERMISSION.REQUEST]).grantee(requestRole).grant(api));
        //Grant roles to users
        await io_utils.ignoreError(new io_role.Role(agentRole).grantTo(api, agent, false));
        await io_utils.ignoreError(new io_role.Role(requestRole).grantTo(api, grantee, false));

        //login in sessions
        apiAsAgent = new MamoriService(host, INSECURE);
        await apiAsAgent.login(agent, agentpw);
        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);
    });

    afterAll(async () => {
        await io_utils.ignoreError(requestAlert.delete(api));
        await io_utils.ignoreError(endorseAlert.delete(api));

        await apiAsAgent.logout();
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.delete_user(agent);
        await io_utils.ignoreError(new io_role.Role(agentRole).delete(api));
        await io_utils.ignoreError(new io_role.Role(requestRole).delete(api));
        await api.logout();
    });

    test('policy 01', async () => {
        let name = "test_auto_policy_" + testbatch;
        let k = new io_ondemandpolicies.OnDemandPolicy(name);
        k.request_role = requestRole;
        k.requires = agentRole;
        k.request_alert = requestAlert.name;
        k.endorse_alert = endorseAlert.name;
        k.addParameter("time", "number of minutes", "15");
        k.withScript(["GRANT SELECT ON * TO :APPLICANT VALID FOR :time minutes"]);

        await io_utils.noThrow(k.delete(api));
        let x = await io_utils.noThrow(k.create(api));
        expect(x).toSucceed();

        let x3 = await io_utils.noThrow(io_ondemandpolicies.OnDemandPolicy.get(api, name));
        expect(x3.name).toBeDefined();

        let x2 = await io_utils.noThrow(k.delete(api));
        expect(x2).toSucceed();

    });


    test('policy 02 - resource', async () => {
        let name = "test_auto_Resource_policy_" + testbatch;
        let k = new io_ondemandpolicies.OnDemandPolicy(name, io_ondemandpolicies.POLICY_TYPES.RESOURCE);
        k.request_role = requestRole;
        k.requires = agentRole;
        k.request_alert = requestAlert.name;
        k.endorse_alert = endorseAlert.name;
        k.addParameter("time", "number of minutes", "15");
        k.withScript(["GRANT :privileges ON :resource_name TO :applicant VALID for :time minutes;"]);

        await io_utils.noThrow(k.delete(api));
        let x = await io_utils.noThrow(k.create(api));
        expect(x).toSucceed();
        let x3 = await io_utils.noThrow(io_ondemandpolicies.OnDemandPolicy.get(api, name));
        if(!x3.name) {
            throw x3;
        }

        let x2 = await io_utils.noThrow(k.delete(api));
        expect(x2).toSucceed();

    });



});

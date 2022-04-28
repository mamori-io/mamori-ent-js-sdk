import { MamoriService } from '../../api';
import * as https from 'https';
import { OnDemandPolicy } from '../../on-demand-policy';
import { Role } from '../../role';
import { User } from '../../user';
import { MamoriPermission, MAMORI_PERMISSION } from '../../permission';
import { handleAPIException, noThrow, ignoreError } from '../../utils';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

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

    beforeAll(async () => {
        console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        //Agent
        let agentU = new User(agent).withEmail(agent + "@ace.com").withFullName("Agent User");
        await ignoreError(agentU.delete(api));
        let res = await noThrow(agentU.create(api, agentpw));
        expect(res.error).toBe(false);


        //Policy User
        let policyU = new User(grantee).withEmail(agent + "@ace.com").withFullName("Policy User");
        await ignoreError(policyU.delete(api));
        let res2 = await noThrow(policyU.create(api, granteepw));
        expect(res2.error).toBe(false);


        //create roles
        await ignoreError(new Role(agentRole).delete(api));
        await ignoreError(new Role(requestRole).delete(api));
        await ignoreError(new Role(agentRole).create(api));
        await ignoreError(new Role(requestRole).create(api));
        //grant request permission to user role
        await ignoreError(new MamoriPermission([MAMORI_PERMISSION.REQUEST]).grantee(requestRole).grant(api));
        //Grant roles to users
        await ignoreError(new Role(agentRole).grantTo(api, agent));
        await ignoreError(new Role(requestRole).grantTo(api, grantee));

        //login in sessions
        apiAsAgent = new MamoriService(host, INSECURE);
        await apiAsAgent.login(agent, agentpw);
        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);
    });

    afterAll(async () => {
        await apiAsAgent.logout();
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.delete_user(agent);
        await ignoreError(new Role(agentRole).delete(api));
        await ignoreError(new Role(requestRole).delete(api));
        await api.logout();
    });

    test('policy 01', async done => {
        let name = "test_auto_policy_" + testbatch;
        let k = new OnDemandPolicy(name);
        k.request_role = requestRole;
        k.requires = agentRole;
        k.withScript(["GRANT SELECT ON * TO :APPLICANT VALID FOR :time minutes"]);

        await noThrow(k.delete(api));
        let x = await noThrow(k.create(api));
        expect(x.error).toBe(false);

        done();
    });




});
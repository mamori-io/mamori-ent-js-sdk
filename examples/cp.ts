import { lchmodSync } from "fs";
import {MamoriService, io_https, io_utils} from '../src/api';
import {io_policy, io_alertchannel, io_role, io_permission, io_user} from "../src/api";

const mamoriUrl = process.env.MAMORI_SERVER || '';
const mamoriUser = process.env.MAMORI_USERNAME ||'';
const mamoriPwd = process.env.MAMORI_PASSWORD ||'';
const INSECURE = new io_https.Agent({rejectUnauthorized: false});

async function () {
    let api = new MamoriService (mamoriUrl);
    console.info("connecting...");
    let login = await api.login (mamoriUser, mamoriPwd);
    console.info("Login successful for:", login.fullname, "session:", login.session_id);

    console.info("creating alert...");
    let requestAlert = new io_alertchannel.AlertChannel("example_alert");
    requestAlert.addEmailAlert("frodo@mordor.com", "request alert ", "REQUEST BODY");
    let r = await io_utils.noThrow(requestAlert.create(api));
    if (r && r.id) {
        requestAlert.id = r.id;
    }

    console.info("creating connection policy...");
    let name = "c-policy";
    let cleanit = await io_utils.noThrow(io_alertchannel.AlertChannel.get(api, name));
    if (cleanit.length > 0){
        let p2 = io_policy.ConnectionPolicy.build(cleanit[0]);
        await io_utils.noThrow(p2.delete(api));
    }

    //delete old one
    let p2 = io_utils.noThrow(io_alertchannel.AlertChannel.get(api, name));
    if (p2) {
        await io_utils.ignoreError(p2.delete(api));
    }

    //set config for new one
    let policy = new io_policy.ConnectionPolicy(io_policy.POLICY_TYPES.BEFORE_CONNECTION, name);
    policy.withEnabled(false)
          .withPosition(20)
          .withEnabled(false)
          .withAction(io_policy.POLICY_ACTIONS.ALLOW)
          .withRuleType(io_policy.POLICY_RULE_TYPE.WHEN)
          .withRuleSEXP("(SOURCE-IP 127.0.0.1)")
          .withAlert(requestAlert.name);
    let x = await io_utils.noThrow(policy.create(api));

    console.log("**** %o", x);
    api.logout();
}

example()
   .catch(e => console.error("ERROR:", e));
   .finally(() => process.exit (0));
import { MamoriService } from '../../api';
import * as https from 'https';
import { Role } from '../../role';
import { Tag } from '../../tag';
import { DatasourcePermission, DB_PERMISSION, TIME_UNIT } from '../../permission';
import { handleAPIException, noThrow, ignoreError, FILTER_OPERATION } from '../../utils';
import '../../__utility__/jest/error_matcher';

const testbatch = process.env.MAMORI_TEST_BATCH || '';
const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("role tests", () => {

    let api: MamoriService;
    let apiAsAPIUser: MamoriService;
    let grantee = "test_roles_user." + testbatch;
    let granteepw = "J{J'vpKs!$nW6(6A,4!98712_vdQ'}D"

    beforeAll(async () => {
        //console.log("login %s %s", host, username);
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);

        await ignoreError(api.delete_user(grantee));
        await api.create_user({
            username: grantee,
            password: granteepw,
            fullname: grantee,
            identified_by: "password",
            email: "test@test.test"
        }).catch(e => {
            fail(handleAPIException(e));
        })

        apiAsAPIUser = new MamoriService(host, INSECURE);
        await apiAsAPIUser.login(grantee, granteepw);

    });

    afterAll(async () => {
        await apiAsAPIUser.logout();
        await api.delete_user(grantee);
        await api.logout();
    });

    test('role 01', async () => {

        let name = "test_automated_role" + testbatch;
        let k = new Role(name);

        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api));
        expect(res).toSucceed();

        //Ensure key returned properly
        let x = (await noThrow(Role.getAll(api))).filter((o: any) => o.roleid == k.roleid);
        expect(x.length).toBe(1);

        //Ensure non-admins can't see any keys

        let x2 = (await noThrow(k.getGrantees(apiAsAPIUser)))
        expect(x2.length).toBe(0);
        //Grant to user
        let x3 = await noThrow(k.grantTo(api, grantee, false));
        expect(x3).toSucceed();
        //Ensure user can see the role
        let x4 = (await noThrow(k.getGrantees(apiAsAPIUser)))
        expect(x4.length).toBe(1);
        //Ensure user can't delete the item
        let resDel2 = await ignoreError(k.delete(apiAsAPIUser));
        expect(resDel2.response.status).toBeGreaterThanOrEqual(400);
        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toSucceed();
        //Ensure the role was revoked
        let x6 = (await noThrow(k.getGrantees(apiAsAPIUser)))
        expect(x6.length).toBe(0);
        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();

    });


    test('role 02', async () => {

        let name = "test_2_automated_role" + testbatch;
        let k = new Role(name);

        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api));
        expect(res.error).toBe(false);
        //Ensure key returned properly
        let x = (await noThrow(Role.getAll(api))).filter((o: any) => o.roleid == k.roleid);
        expect(x.length).toBe(1);

        //Grant to user
        let x3 = await noThrow(k.grantTo(api, grantee, false, Role.optionValidFor(TIME_UNIT.MINUTES, 30)));
        expect(x3).toSucceed();
        //Ensure user can see the role
        let x4 = await noThrow(k.getGrantees(api));
        expect(x4.length).toBe(1);
        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toSucceed();
        //Ensure the role was revoked
        let x6 = await noThrow(k.getGrantees(api));
        expect(x6.length).toBe(0);
        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();

    });

    /*
    * [ch4247] - "SYS"."USER_PERMISSIONS" incorrectly showing user permissions via roles that the user created but not granted to themselves
    */
    test('role ch4247', async () => {
        let roleName = "test_ch4247_role" + testbatch;
        let k = new Role(roleName);
        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api));
        expect(res).toSucceed();
        //Ensure role created
        let x = (await noThrow(Role.getAll(api))).filter((o: any) => o.roleid == k.roleid);
        expect(x.length).toBe(1);
        //Grant passthrough to role
        let grant = new DatasourcePermission().on("*", "", "", "").permission(DB_PERMISSION.PROTECTED).grantee(roleName);
        let resp = await noThrow(grant.grant(api));
        expect(resp).toSucceed();
        //CONFIRM ROLE HAS THE PERMISSION
        let filter0 = [["permissiontype", FILTER_OPERATION.EQUALS_STRING, DB_PERMISSION.PROTECTED]];
        let r0 = await grant.list(api, filter0);
        expect(r0.totalCount).toBe(1);
        //CONFIRM ADMIN DOES NOT HAVE THE PERMISSIONS
        let r1 = await new DatasourcePermission().grantee(username).list(api, filter0);
        expect(r1.totalCount).toBe(0);
        // Delete the role
        let rd = await noThrow(k.delete(api));
        expect(res).toSucceed();
        //CONFIRM ROLE NO LONGER HAS THE PERMISSION
        let r2 = await grant.list(api, filter0);
        expect(r2.totalCount).toBe(0);
    });

    test('role with keyword', async () => {

        let name = "admin-api-test_role-with" + testbatch;
        let k = new Role(name);

        await ignoreError(k.delete(api));
        let res = await noThrow(k.create(api));
        expect(res).toSucceed();
        //Ensure key returned properly
        let x = (await noThrow(Role.getAll(api))).filter((o: any) => o.roleid == k.roleid);
        expect(x.length).toBe(1);

        //Grant to user
        let x3 = await noThrow(k.grantTo(api, grantee, false, Role.optionValidFor(TIME_UNIT.MINUTES, 30)));
        expect(x3).toSucceed();
        //Ensure user can see the role
        let x4 = await noThrow(k.getGrantees(api));
        expect(x4.length).toBe(1);
        let x5 = await noThrow(k.revokeFrom(api, grantee));
        expect(x5).toSucceed();
        //Ensure the role was revoked
        let x6 = await noThrow(k.getGrantees(api));
        expect(x6.length).toBe(0);
        //Delete the data source
        let resDel = await noThrow(k.delete(api));
        expect(resDel).toSucceed();

    });

    test('role tags - add/remove (delete does not cascade role_tags)', async () => {
        const roleName = 'test_role_tags_' + testbatch;
        const tagName = 'test_role_tag_' + testbatch;
        const role = new Role(roleName);
        await ignoreError(role.delete(api));
        const existingTag = await ignoreError(Tag.getByName(api, tagName));
        if (existingTag && existingTag.id) {
            await ignoreError(existingTag.delete(api));
        }

        expect(await noThrow(role.create(api))).toSucceed();

        const tag = new Tag(tagName);
        expect(await noThrow(tag.create(api))).toSucceed();
        expect(tag.id).toBeTruthy();

        try {
            expect(await noThrow(role.addTag(api, tag))).toSucceed();

            let assignments = await noThrow(Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            let match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'role' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === roleName.toLowerCase(),
            );
            expect(match.length).toBe(1);

            expect(await noThrow(role.removeTag(api, tag))).toSucceed();
            assignments = await noThrow(Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'role' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === roleName.toLowerCase(),
            );
            expect(match.length).toBe(0);

            expect(await noThrow(role.addTag(api, tagName))).toSucceed();
            // No FK cascade from sysroles to role_tags; clear before delete.
            expect(await noThrow(role.removeTag(api, tag))).toSucceed();
            expect(await noThrow(role.delete(api))).toSucceed();

            assignments = await noThrow(Tag.listAssignments(api, tag.id));
            expect(assignments.errors).not.toBe(true);
            match = assignments.filter(
                (r: any) =>
                    String(r.resource_type || r.RESOURCE_TYPE).toLowerCase() === 'role' &&
                    String(r.resource_key || r.RESOURCE_KEY).toLowerCase() === roleName.toLowerCase(),
            );
            expect(match.length).toBe(0);
        } finally {
            await ignoreError(role.delete(api));
            await ignoreError(tag.delete(api));
        }
    });

});

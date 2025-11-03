import { MamoriService } from "../../api";
import { Role } from "../../role";
import * as https from "https";
import { noThrow, ignoreError } from "../../utils";
import "../../__utility__/jest/error_matcher";
import * as helper from '../../__utility__/test-helper';

describe("Admin-Initiated Password Reset Feature Tests", () => {
  const testbatch = process.env.MAMORI_TEST_BATCH || "";
  const host = process.env.MAMORI_SERVER || "";
  const adminUser = process.env.MAMORI_USERNAME || "";
  const adminPass = process.env.MAMORI_PASSWORD || "";
  const INSECURE = new https.Agent({ rejectUnauthorized: false });

  let api: MamoriService;
  const targetUser = ("t_reset_admin_" + testbatch).toLowerCase();
  const targetPass = "Aq1!aQ1!aQ1!";
  const newPassword = "NewP@ssw0rd123!";

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(adminUser, adminPass);
    
    // Ensure admin user has mamori_admin role (grant if not present)
    // This is critical for admin-initiated password reset functionality
    const adminRole = new Role("mamori_admin");
    await noThrow(adminRole.grantTo(api, api.username || adminUser, false));
    
    await ignoreError(api.delete_user(targetUser));
    await noThrow(
      api.create_user({
        username: targetUser,
        password: targetPass,
        fullname: targetUser,
        identified_by: "password",
        email: `${targetUser}@test.com`,
      }),
    );
  });

  afterAll(async () => {
    if (api) {
      await ignoreError(api.delete_user(targetUser));
      await api.logout();
    }
  });

  /**
   * Helper function to wait for token generation with polling
   */
  async function waitForResetToken(
    ws: any,
    username: string,
    timeout: number = 10000,
    pollInterval: number = 500
  ): Promise<string | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const rows = await ws.queryRows(
        `select token, created_at, expires_at 
         from SYS.RESET_TOKENS 
         where lower(username)=lower('${username}') 
         and kind='reset_password' 
         and applied_at is null`
      );
      
      if (rows && rows.length > 0 && rows[0].token) {
        return rows[0].token;
      }
      
      await helper.sleep(pollInterval);
    }
    return null;
  }

  /**
   * Helper function to verify token is applied (applied_at is set)
   */
  async function verifyTokenApplied(ws: any, token: string): Promise<boolean> {
    const rows = await ws.queryRows(
      `select count(1) as cnt
       from SYS.RESET_TOKENS 
       where token='${token.replace(/'/g, "''")}' 
       and applied_at is not null`
    );
    
    return rows && rows.length > 0 && Number(rows[0].cnt) > 0;
  }

  /**
   * Test 1: Admin-Initiated Password Reset - Basic Flow
   * Verify that an admin can successfully initiate a password reset for a user via the REST API endpoint.
   */
  test.skip("1. Admin-Initiated Password Reset - Basic Flow", async () => {
    const ws = await api.wsLogin();
    
    try {
      // Call admin API to reset password
      const resetResponse = await noThrow(api.reset_user_password(targetUser));
      // Verify API call succeeded (response is "ok" or object without errors property on success)
      expect(resetResponse).toBeDefined();
      if (resetResponse.errors !== undefined) {
        expect(resetResponse.errors).toBe(false);
      }
      // Response structure depends on API implementation
      
      // Wait for token to be created (asynchronous process)
      const token = await waitForResetToken(ws, targetUser, 10000);
      console.log("!!! TEST 1: token", token);
      
      // Verify token was created
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token!.length).toBeGreaterThan(0);
      
      // Verify token properties
      const tokenRows = await ws.queryRows(
        `select token, username, kind, created_at, expires_at, applied_at
         from SYS.RESET_TOKENS 
         where token='${token!.replace(/'/g, "''")}'`
      );
      
      expect(tokenRows.length).toBe(1);
      expect(tokenRows[0].username.toLowerCase()).toBe(targetUser.toLowerCase());
      expect(tokenRows[0].kind).toBe("reset_password");
      expect(tokenRows[0].applied_at).toBeNull();
      expect(tokenRows[0].expires_at).toBeTruthy();
      
      // Verify created_at is recent (within last 10 minutes to account for delays)
      const createdAt = new Date(tokenRows[0].created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      expect(diffSeconds).toBeLessThan(600); // 10 minutes should be more than enough
      
    } finally {
      ws.disconnect();
    }
  });

  /**
   * Test 2: Admin-Initiated Password Reset - Verify Audit Log Entry
   * Verify that admin-initiated password reset generates CREDENTIAL_RESET REQUESTED audit log entry.
   */
  test.skip("2. Admin-Initiated Password Reset - Verify Audit Log Entry", async () => {
    const ws = await api.wsLogin();
    
    try {
      // Get admin username for initiator verification
      const adminUsername = api.username;
      
      // Call admin API to reset password
      const resetResponse = await noThrow(api.reset_user_password(targetUser));
      if (resetResponse.errors !== undefined) {
        expect(resetResponse.errors).toBe(false);
      }
      
      // Wait for token to be created
      const token = await waitForResetToken(ws, targetUser, 10000);
      expect(token).toBeTruthy();
      
      // Wait for audit log entry (may be async)
      await helper.sleep(2000);
      
      // Query audit log for CREDENTIAL_RESET REQUESTED event
      const auditRows = await ws.queryRows(
        `select username, query, query_category, query_subcategory, details, inserted_at
         from SYS.AUDIT_LOG
         where username = lower('${targetUser}')
         and query = 'CREDENTIAL_RESET REQUESTED'
         order by inserted_at desc
         limit 1`
      );
      
      expect(auditRows.length).toBeGreaterThan(0);
      const auditEntry = auditRows[0];
      
      // Verify audit log entry properties
      expect(auditEntry.username.toLowerCase()).toBe(targetUser.toLowerCase());
      expect(auditEntry.query).toBe("CREDENTIAL_RESET REQUESTED");
      expect(auditEntry.query_category).toBe("SECURITY");
      expect(auditEntry.query_subcategory).toBe("CREDENTIAL_RESET");
      
      // Verify details contain expected metadata
      if (auditEntry.details) {
        const details = JSON.parse(auditEntry.details);
        expect(details.target_user).toBe(targetUser);
        expect(details.token).toBe(token);
      }
      
    } finally {
      ws.disconnect();
    }
  });

  /**
   * Test 3: Admin-Initiated Password Reset - Token Activation Flow
   * Verify that a reset token created via admin API can be activated to change password.
   */
  test.skip("3. Admin-Initiated Password Reset - Token Activation Flow", async () => {
    const ws = await api.wsLogin();
    
    try {
      // Call admin API to reset password
      const resetResponse = await noThrow(api.reset_user_password(targetUser));
      if (resetResponse.errors !== undefined) {
        expect(resetResponse.errors).toBe(false);
      }
      
      // Wait for token to be created
      const token = await waitForResetToken(ws, targetUser, 10000);
      expect(token).toBeTruthy();
      
      // Validate token to get session_id
      const validateResponse = await noThrow(ws.sendRequest({
        command: "validate_reset",
        options: { token: token!, session_id: null }
      }));
      
      if (validateResponse.errors) {
        throw new Error(`Failed to validate token: ${validateResponse.message || 'Unknown error'}`);
      }
      
      let sessionId = null;
      if (validateResponse.rows && validateResponse.rows[0]) {
        sessionId = validateResponse.rows[0][0];
      }
      
      // Perform reset using websocket (same as self-service)
      const performResponse = await noThrow(ws.sendRequest({
        command: "perform_reset",
        options: {
          token: token!,
          session_id: sessionId,
          password: newPassword
        }
      }));
      
      if (performResponse.errors || performResponse.error) {
        throw new Error(`Failed to perform reset: ${performResponse.message || 'Unknown error'}`);
      }
      expect(performResponse.error).toBe(false);
      
      // Wait for processing
      await helper.sleep(1000);
      
      // Verify token is marked as applied
      const isApplied = await verifyTokenApplied(ws, token!);
      expect(isApplied).toBe(true);
      
      // Verify password change
      const testApi1 = new MamoriService(host, INSECURE);
      await expect(
        testApi1.login(targetUser, targetPass)
      ).rejects.toThrow();
      testApi1.logout().catch(() => {});
      
      const testApi2 = new MamoriService(host, INSECURE);
      const loginResult = await noThrow(testApi2.login(targetUser, newPassword));
      if (loginResult.errors) {
        throw new Error(`Failed to login with new password: ${loginResult.message || 'Unknown error'}`);
      }
      expect(testApi2.username).toBe(targetUser);
      await testApi2.logout();
      
      // Verify audit log entry for activation
      await helper.sleep(1000);
      const auditRows = await ws.queryRows(
        `select username, query, query_category, query_subcategory
         from SYS.AUDIT_LOG
         where username = lower('${targetUser}')
         and query = 'CREDENTIAL_RESET ACTIVATED'
         order by inserted_at desc
         limit 1`
      );
      
      expect(auditRows.length).toBeGreaterThan(0);
      expect(auditRows[0].query).toBe("CREDENTIAL_RESET ACTIVATED");
      
      // Clean up: reset password back
      const updateResponse = await noThrow(api.user_update(targetUser, { password: targetPass }));
      if (updateResponse.errors) {
        throw new Error(`Failed to reset password: ${updateResponse.message || 'Unknown error'}`);
      }
      
    } finally {
      ws.disconnect();
    }
  });

  /**
   * Test 4: Admin-Initiated Password Reset - Error Handling (Non-Existent User)
   * Verify that resetting password for a non-existent user returns appropriate error.
   */
  test.skip("4. Admin-Initiated Password Reset - Error Handling (Non-Existent User)", async () => {
    const ws = await api.wsLogin();
    const nonexistentUser = "nonexistent_user_9762";
    
    try {
      // Attempt to reset password for non-existent user
      await expect(
        api.reset_user_password(nonexistentUser)
      ).rejects.toThrow();
      
      // Verify no token was created
      await helper.sleep(1000);
      const tokens = await ws.queryRows(
        `select count(1) as cnt
         from SYS.RESET_TOKENS
         where lower(username) = lower('${nonexistentUser}')
         and kind = 'reset_password'`
      );
      
      expect(Number(tokens[0].cnt)).toBe(0);
      
    } finally {
      ws.disconnect();
    }
  });

  /**
   * Test 5: Admin-Initiated Password Reset - Authorization Check
   * Verify that only users with appropriate permissions (specifically mamori_admin role) can call the reset password API.
   */
  test.skip("5. Admin-Initiated Password Reset - Authorization Check", async () => {
    const nonAdminUser = ("t_nonadmin_9762" + testbatch).toLowerCase();
    const nonAdminPass = "NonAdmin123!";
    
    // Ensure admin user has mamori_admin role (grant if not present)
    const adminRole = new Role("mamori_admin");
    await noThrow(adminRole.grantTo(api, api.username || adminUser, false));
    
    // Create non-admin user (without mamori_admin role)
    const createResponse = await noThrow(api.create_user({
      username: nonAdminUser,
      password: nonAdminPass,
      fullname: nonAdminUser,
      identified_by: "password",
      email: `${nonAdminUser}@test.com`,
    }));
    if (createResponse.errors) {
      throw new Error(`Failed to create non-admin user: ${createResponse.message || 'Unknown error'}`);
    }
    
    try {
      // Login as non-admin
      const nonAdminApi = new MamoriService(host, INSECURE);
      await nonAdminApi.login(nonAdminUser, nonAdminPass);
      
      // Attempt to reset password (should fail - user lacks mamori_admin role)
      await expect(
        nonAdminApi.reset_user_password(targetUser)
      ).rejects.toThrow();
      
      await nonAdminApi.logout();
      
      // Verify admin (with mamori_admin role) can reset password
      const ws = await api.wsLogin();
      const resetResponse = await noThrow(api.reset_user_password(targetUser));
      if (resetResponse.errors !== undefined) {
        expect(resetResponse.errors).toBe(false);
      }
      const token = await waitForResetToken(ws, targetUser, 10000);
      expect(token).toBeTruthy();
      ws.disconnect();
      
    } finally {
      await ignoreError(api.delete_user(nonAdminUser));
    }
  });

  /**
   * Test 6: Admin-Initiated Password Reset - Multiple Resets
   * Verify that multiple admin-initiated password resets create separate tokens and audit entries.
   */
  test.skip("6. Admin-Initiated Password Reset - Multiple Resets", async () => {
    const ws = await api.wsLogin();
    
    try {
      // First reset
      const resetResponse1 = await noThrow(api.reset_user_password(targetUser));
      if (resetResponse1.errors !== undefined) {
        expect(resetResponse1.errors).toBe(false);
      }
      const token1 = await waitForResetToken(ws, targetUser, 10000);
      expect(token1).toBeTruthy();
      
      await helper.sleep(2000);
      
      // Second reset
      const resetResponse2 = await noThrow(api.reset_user_password(targetUser));
      if (resetResponse2.errors !== undefined) {
        expect(resetResponse2.errors).toBe(false);
      }
      const token2 = await waitForResetToken(ws, targetUser, 10000);
      expect(token2).toBeTruthy();
      
      // Verify both tokens exist or only latest (depends on implementation)
      const allTokens = await ws.queryRows(
        `select token, created_at
         from SYS.RESET_TOKENS
         where lower(username) = lower('${targetUser}')
         and kind = 'reset_password'
         and applied_at is null
         order by created_at desc`
      );
      
      // Verify at least one token exists (may cancel previous tokens)
      expect(allTokens.length).toBeGreaterThan(0);
      
      // Verify audit log entries
      await helper.sleep(2000);
      const auditRows = await ws.queryRows(
        `select username, query, inserted_at
         from SYS.AUDIT_LOG
         where username = lower('${targetUser}')
         and query = 'CREDENTIAL_RESET REQUESTED'
         order by inserted_at desc
         limit 2`
      );
      
      expect(auditRows.length).toBeGreaterThanOrEqual(1);
      
    } finally {
      ws.disconnect();
    }
  });

  /**
   * Test 7: Admin-Initiated Password Reset - Compare with Self-Service
   * Verify that admin-initiated and self-service password resets generate identical token structure and audit entries (except for initiator).
   */
  test.skip("7. Admin-Initiated Password Reset - Compare with Self-Service", async () => {
    const ws = await api.wsLogin();
    const user1 = (targetUser + "_admin_reset").toLowerCase();
    const user2 = (targetUser + "_self_reset").toLowerCase();
    
    try {
      // Create users
      const createResponse1 = await noThrow(api.create_user({
        username: user1,
        password: targetPass,
        fullname: user1,
        identified_by: "password",
        email: `${user1}@test.com`,
      }));
      if (createResponse1.errors) {
        throw new Error(`Failed to create user1: ${createResponse1.message || 'Unknown error'}`);
      }
      
      const createResponse2 = await noThrow(api.create_user({
        username: user2,
        password: targetPass,
        fullname: user2,
        identified_by: "password",
        email: `${user2}@test.com`,
      }));
      if (createResponse2.errors) {
        throw new Error(`Failed to create user2: ${createResponse2.message || 'Unknown error'}`);
      }
      
      // Admin-initiated reset
      const resetResponse = await noThrow(api.reset_user_password(user1));
      if (resetResponse.errors !== undefined) {
        expect(resetResponse.errors).toBe(false);
      }
      const adminToken = await waitForResetToken(ws, user1, 10000);
      expect(adminToken).toBeTruthy();
      
      // Self-service reset
      const passwordResetResponse = await noThrow(ws.sendRequest({
        command: "password_reset",
        options: { user: user2 }
      }));
      if (passwordResetResponse.errors || passwordResetResponse.error) {
        throw new Error(`Failed to initiate self-service reset: ${passwordResetResponse.message || 'Unknown error'}`);
      }
      const selfToken = await waitForResetToken(ws, user2, 10000);
      expect(selfToken).toBeTruthy();
      
      // Compare tokens
      const adminTokenRow = await ws.queryRows(
        `select * from SYS.RESET_TOKENS where token='${adminToken!.replace(/'/g, "''")}'`
      );
      
      const selfTokenRow = await ws.queryRows(
        `select * from SYS.RESET_TOKENS where token='${selfToken!.replace(/'/g, "''")}'`
      );
      
      expect(adminTokenRow.length).toBe(1);
      expect(selfTokenRow.length).toBe(1);
      expect(adminTokenRow[0].kind).toBe(selfTokenRow[0].kind);
      expect(adminTokenRow[0].kind).toBe("reset_password");
      
      // Compare audit log entries
      await helper.sleep(2000);
      const adminAudit = await ws.queryRows(
        `select * from SYS.AUDIT_LOG
         where username = lower('${user1}')
         and query = 'CREDENTIAL_RESET REQUESTED'
         order by inserted_at desc limit 1`
      );
      
      const selfAudit = await ws.queryRows(
        `select * from SYS.AUDIT_LOG
         where username = lower('${user2}')
         and query = 'CREDENTIAL_RESET REQUESTED'
         order by inserted_at desc limit 1`
      );
      
      expect(adminAudit.length).toBe(1);
      expect(selfAudit.length).toBe(1);
      expect(adminAudit[0].query).toBe(selfAudit[0].query);
      expect(adminAudit[0].query_category).toBe(selfAudit[0].query_category);
      
    } finally {
      await ignoreError(api.delete_user(user1));
      await ignoreError(api.delete_user(user2));
      ws.disconnect();
    }
  });
});


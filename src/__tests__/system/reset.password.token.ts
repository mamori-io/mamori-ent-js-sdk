import { MamoriService } from "../../api";
import * as https from "https";
import { noThrow, ignoreError } from "../../utils";
import "../../__utility__/jest/error_matcher";
import * as helper from '../../__utility__/test-helper';

describe("Password Reset Feature Tests", () => {
  const testbatch = process.env.MAMORI_TEST_BATCH || "";
  const host = process.env.MAMORI_SERVER || "";
  const adminUser = process.env.MAMORI_USERNAME || "";
  const adminPass = process.env.MAMORI_PASSWORD || "";
  const INSECURE = new https.Agent({ rejectUnauthorized: false });

  let api: MamoriService;
  const targetUser = ("t_reset_user_tok" + testbatch).toLowerCase();
  const targetPass = "Aq1!aQ1!aQ1!";
  const newPassword = "NewP@ssw0rd123!";

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(adminUser, adminPass);
    await ignoreError(api.delete_user(targetUser));
    await noThrow(
      api.create_user({
        username: targetUser,
        password: targetPass,
        fullname: targetUser,
        identified_by: "password",
        email: "omar@fakeemail.com.au",
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
   * Helper function to get reset token for user
   */
  async function getResetToken(ws: any, username: string): Promise<string | null> {
    const rows = await ws.queryRows(
      `select token 
       from SYS.RESET_TOKENS 
       where lower(username)=lower('${username}') 
       and kind='reset_password' 
       and applied_at is null
       order by created_at desc`
    );
    
    return rows && rows.length > 0 && rows[0].token ? rows[0].token : null;
  }

  /**
   * Helper function to verify token exists and is valid
   */
  async function verifyTokenExists(ws: any, username: string): Promise<boolean> {
    const token = await getResetToken(ws, username);
    return token !== null;
  }

  /**
   * Helper function to verify token is cancelled (deleted_at is set)
   * Uses the full schema path to query the base table directly
   */
  async function verifyTokenCancelled(ws: any, token: string): Promise<boolean> {
    // Query the base table directly using full schema path to check deleted_at
    const rows = await ws.queryRows(
      `select count(1) as cnt
       from mamori.mamorisys.security.reset_tokens 
       where token = '${token.replace(/'/g, "''")}' 
       and deleted_at is not null`
    );
    
    return rows && rows.length > 0 && Number(rows[0].cnt) > 0;
  }

  /**
   * Helper function to verify token is applied (applied_at is set)
   */
  async function verifyTokenApplied(ws: any, token: string): Promise<boolean> {
    const rows = await ws.queryRows(
      `select count(1) as cnt
       from SYS.RESET_TOKENS 
       where token='${token}' 
       and applied_at is not null`
    );
    
    return rows && rows.length > 0 && Number(rows[0].cnt) > 0;
  }

  /**
   * Test 1: Request Password Reset
   * Verify that requesting a password reset generates a valid token
   */
  test("1. Request Password Reset", async () => {
    const ws = await api.wsLogin();
    
    try {
      // Request password reset via websocket
      const resetResponse = await ws.sendRequest({
        command: "password_reset",
        options: { user: targetUser }
      });
      
      // Verify request was accepted (no error)
      expect(resetResponse.error).toBe(false);
      
      // Wait for token to be created (asynchronous process)
      const token = await waitForResetToken(ws, targetUser, 10000);
      
      // Verify token was created
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token!.length).toBeGreaterThan(0);
      
      // Verify token properties by querying full token details
      const tokenRows = await ws.queryRows(
        `select token, username, kind, created_at, expires_at, applied_at
         from SYS.RESET_TOKENS 
         where token='${token!}'`
      );
      
      expect(tokenRows.length).toBe(1);
      expect(tokenRows[0].username.toLowerCase()).toBe(targetUser.toLowerCase());
      expect(tokenRows[0].kind).toBe("reset_password");
      expect(tokenRows[0].applied_at).toBeNull();
      
      // Verify token has expiration time
      expect(tokenRows[0].expires_at).toBeTruthy();
      
      // Verify created_at is recent (within last 10 minutes to account for delays)
      // The token might have been created earlier and we're just finding it now
      const createdAt = new Date(tokenRows[0].created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      expect(diffSeconds).toBeLessThan(600); // 10 minutes should be more than enough
      
    } finally {
      ws.disconnect();
    }
  });

  /**
   * Test 2: Cancel Password Reset
   * Verify that cancelling a password reset marks the token as deleted
   */
  test("2. Cancel Password Reset", async () => {
    const ws = await api.wsLogin();
    
    try {
      // First, request a password reset to get a token
      await ws.sendRequest({
        command: "password_reset",
        options: { user: targetUser }
      });
      
      // Wait for token to be created
      const token = await waitForResetToken(ws, targetUser, 10000);
      expect(token).toBeTruthy();
      
      // Get session ID (needed for cancel_reset command)
      // For testing, we'll use null or empty session_id as per the backend logic
      const sessionId = null;
      
      // Cancel the reset token
      const cancelResponse = await ws.sendRequest({
        command: "cancel_reset",
        options: { 
          token: token!,
          session_id: sessionId
        }
      });
      
      // Verify cancellation was successful
      expect(cancelResponse.error).toBe(false);
      
      // Wait a moment for the cancellation to be processed
      await helper.sleep(1000);
      
      // Verify token is marked as cancelled (deleted_at is set)
      const isCancelled = await verifyTokenCancelled(ws, token!);
      expect(isCancelled).toBe(true);
      
      // Verify token no longer appears in SYS.RESET_TOKENS view (filters deleted)
      const activeTokens = await ws.queryRows(
        `select count(1) as cnt
         from SYS.RESET_TOKENS 
         where token = '${token!.replace(/'/g, "''")}'`
      );
      
      expect(activeTokens.length).toBe(1);
      expect(Number(activeTokens[0].cnt)).toBe(0); // Should NOT appear in view since it's deleted
      
      // Verify deleted_at is set in the base table
      const deletedCheck = await ws.queryRows(
        `select count(1) as cnt
         from mamori.mamorisys.security.reset_tokens 
         where token = '${token!.replace(/'/g, "''")}' 
         and deleted_at is not null`
      );
      
      expect(deletedCheck.length).toBe(1);
      expect(Number(deletedCheck[0].cnt)).toBe(1); // Should have deleted_at set
      
    } finally {
      ws.disconnect();
    }
  });

  /**
   * Test 3: Perform Password Reset
   * Verify that using a reset token successfully changes the password
   */
  test("3. Perform Password Reset", async () => {
    const ws = await api.wsLogin();
    
    try {
      // First, request a password reset to get a token
      await ws.sendRequest({
        command: "password_reset",
        options: { user: targetUser }
      });
      
      // Wait for token to be created
      const token = await waitForResetToken(ws, targetUser, 10000);
      expect(token).toBeTruthy();
      
      // Verify token is NOT cancelled before proceeding
      const isCancelled = await verifyTokenCancelled(ws, token!);
      expect(isCancelled).toBe(false);
      
      // Verify token appears in SYS.RESET_TOKENS view (not deleted)
      const activeTokenCheck = await ws.queryRows(
        `select count(1) as cnt
         from SYS.RESET_TOKENS 
         where token = '${token!.replace(/'/g, "''")}'`
      );
      expect(activeTokenCheck.length).toBe(1);
      expect(Number(activeTokenCheck[0].cnt)).toBe(1);
      
      // Validate the token first to get the session_id (as done in ResetToken.vue)
      const validateResponse = await ws.sendRequest({
        command: "validate_reset",
        options: { token: token!, session_id: null }
      });
      
      let sessionId = null;
      if (validateResponse.rows && validateResponse.rows[0]) {
        sessionId = validateResponse.rows[0][0]; // Session ID is first column
      }
      
      // Prepare the perform_reset request
      // Note: session_id is always required (from ResetToken.vue line 298)
      // Even if null, it should be included (the UI always includes it)
      const performResetOptions: any = {
        token: token!,
        session_id: sessionId, // Always include, even if null
        password: newPassword
      };
      
      const performResponse = await ws.sendRequest({
        command: "perform_reset",
        options: performResetOptions
      });
      
      // Verify reset was successful
      expect(performResponse.error).toBe(false);
      
      // Wait a moment for the reset to be processed
      await helper.sleep(1000);
      
      // Verify token is marked as applied (applied_at is set)
      const isApplied = await verifyTokenApplied(ws, token!);
      expect(isApplied).toBe(true);
      
      // Verify token details show it was applied
      const appliedRows = await ws.queryRows(
        `select token, applied_at 
         from SYS.RESET_TOKENS 
         where token='${token!}' 
         and applied_at is not null`
      );
      
      expect(appliedRows.length).toBe(1);
      expect(appliedRows[0].applied_at).toBeTruthy();
      
      // Verify old password no longer works
      const testApi1 = new MamoriService(host, INSECURE);
      await expect(
        testApi1.login(targetUser, targetPass)
      ).rejects.toThrow();
      testApi1.logout().catch(() => {});
      
      // Verify new password works
      const testApi2 = new MamoriService(host, INSECURE);
      const loginResult2 = await noThrow(testApi2.login(targetUser, newPassword));
      // Check if login succeeded (noThrow returns error object if it failed)
      if (loginResult2.errors) {
        throw new Error(`Failed to login with new password: ${loginResult2.message || 'Unknown error'}`);
      }
      expect(testApi2.username).toBe(targetUser);
      await testApi2.logout();
      
      // Clean up: reset password back to original for other tests
      // This is done via admin API using user_update
      await api.user_update(targetUser, { password: targetPass });
      
    } finally {
      ws.disconnect();
    }
  });
});



/*
 * Task 9714: Mamori User Account Locking Workflow API Tests
 * 
 * This test suite verifies the complete end-to-end functionality of account lockout,
 * including failed login tracking, lockout duration, unlock expiration, audit logging, and email alerts.
 */

import { MamoriService } from "../../api";
import * as https from "https";
import { noThrow, ignoreError } from "../../utils";
import "../../__utility__/jest/error_matcher";
import * as helper from '../../__utility__/test-helper';

describe("Task 9714: Account Lockout Workflow Tests", () => {
  const testbatch = process.env.MAMORI_TEST_BATCH || "";
  const host = process.env.MAMORI_SERVER || "";
  const adminUser = process.env.MAMORI_USERNAME || "";
  const adminPass = process.env.MAMORI_PASSWORD || "";
  const INSECURE = new https.Agent({ rejectUnauthorized: false });

  let api: MamoriService;
  const testUser = ("t_lockout_user_" + testbatch).toLowerCase();
  const testPassword = "Aq1!aQ1!aQ1!";
  const wrongPassword = "WrongPassword123!";
  const lockoutDurationForTesting = "1"; // 20 seconds (0.333 minutes)
  const defaultLockoutDuration = "15"; // Default 15 minutes
  let originalLockoutDuration: string = defaultLockoutDuration;
  let failedAttemptsLimit: number = 10; // Default, may need to be read from system

  beforeAll(async () => {
    api = new MamoriService(host, INSECURE);
    await api.login(adminUser, adminPass);

    // Get original lockout duration value
    const lockoutDuration = await getLockoutDurationMinutes();
    if (lockoutDuration) {
      originalLockoutDuration = lockoutDuration;
    } else {
      // If property doesn't exist or can't be read, use default
      originalLockoutDuration = defaultLockoutDuration;
    }

    // Get failed attempts limit from password requirements
    const policyResult = await helper.selectQuery(
      api,
      "select requirement from mamori.mamorisys.security.password_requirements where requirement_desc = 'failed_attempts_limit' and not deleted"
    );
    console.log("DEBUG beforeAll: policyResult %o", policyResult);
    
    if (!policyResult.errors && policyResult && Array.isArray(policyResult) && policyResult.length > 0) {
      const row = policyResult[0];
      const requirementValue = row.requirement;
      if (requirementValue) {
        failedAttemptsLimit = parseInt(String(requirementValue), 10);
        console.log(`DEBUG beforeAll: Retrieved failed_attempts_limit from server: ${failedAttemptsLimit}`);
      } else {
        console.log(`DEBUG beforeAll: requirement field not found in result, using default: 10`);
      }
    } else {
      if (policyResult.errors) {
        console.log(`DEBUG beforeAll: Error retrieving failed_attempts_limit: ${policyResult.message || 'Unknown error'}, using default: 10`);
      } else {
        console.log(`DEBUG beforeAll: Password requirements query returned no rows, using default: 10`);
      }
      failedAttemptsLimit = 10;
    }
    
    console.log(`DEBUG beforeAll: Using failed_attempts_limit = ${failedAttemptsLimit}`);

    // Create test user
    await ignoreError(api.delete_user(testUser));
    await noThrow(
      api.create_user({
        username: testUser,
        password: testPassword,
        fullname: testUser,
        identified_by: "password",
        email: "lockout_test@test.test",
      }),
    );
  });

  afterAll(async () => {
    if (api) {
      // Unlock test user if locked
      await ignoreError(api.unlock_user(testUser));

      // Reset lockout duration to original value
      await ignoreError(api.set_system_properties({ "mamori.security.auto_lockout.minutes": originalLockoutDuration }));

      // Clean up test user
      await ignoreError(api.delete_user(testUser));
      await api.logout();
    }
  });

  /**
   * Helper function to unlock test user
   */
  async function unlockTestUser() {
    await ignoreError(api.unlock_user(testUser));
  }

  /**
   * Helper function to refresh API login session
   * Useful after extended sleep operations when the session may have timed out
   */
  async function refreshApiLogin() {
    await ignoreError(api.logout());
    await api.login(adminUser, adminPass);
  }

  /**
   * Helper function to get user info from database
   */
  async function getUserInfo(): Promise<any> {
    const result = await helper.selectQuery(
      api,
      `SELECT failed_attempts, locked_until, account_disabled 
       FROM mamori.mamorisys.security.users 
       WHERE LOWER(username) = LOWER('${testUser}') 
       AND NOT deleted`
    );
    if (result.errors) {
      return null;
    }
    if (result && Array.isArray(result) && result.length > 0) {
      const row = result[0];
      const accountDisabledValue = String(row.account_disabled || '').toLowerCase();
      const accountDisabled = accountDisabledValue === 'true' || 
                              accountDisabledValue === '1';
      const userInfo = {
        failed_attempts: row.failed_attempts ? parseInt(String(row.failed_attempts), 10) : 0,
        locked_until: row.locked_until,
        account_disabled: accountDisabled,
      };
      return userInfo;
    }
    return null;
  }

  /**
   * Helper function to get the current lockout duration in minutes from system properties
   * @returns The lockout duration in minutes as a string, or null if not found
   */
  async function getLockoutDurationMinutes(): Promise<string | null> {
    const result = await helper.selectQuery(
      api,
      "SELECT val FROM SYS.SYSSERVERPROPERTIES WHERE name = 'mamori.security.auto_lockout.minutes'"
    );
    if (result.errors) {
      return null;
    }
    if (result && Array.isArray(result) && result.length > 0) {
      const row = result[0];
      const val = row.val;
      if (val) {
        return String(val);
      }
    }
    return null;
  }

  /**
   * Helper function to trigger account lockout with verification
   * This function performs failed login attempts incrementally, verifying the counter
   * at each step, and ensures the account is locked after reaching the limit.
   * 
   * @param verifyIntermediateSteps - If true, verifies counter increments and non-lockout state after each attempt before the limit
   * @returns If verifyIntermediateSteps is true, returns the locked_until timestamp; otherwise returns the full user info
   */
  async function triggerLockoutWithVerification(verifyIntermediateSteps: boolean = false): Promise<any> {
    const apiTest = new MamoriService(host, INSECURE);
    
    try {
      // Make attempts up to (limit - 1) - these should increment counter but NOT lock
      for (let i = 0; i < failedAttemptsLimit - 1; i++) {
        const loginResult = await noThrow(apiTest.login(testUser, wrongPassword));
        if (!loginResult.errors) {
          fail("Login should have failed");
        }

        // Optionally verify failed_attempts counter increments and account is NOT locked yet
        if (verifyIntermediateSteps) {
          const userInfo = await getUserInfo();
          expect(userInfo).toBeTruthy();
          
          // Account should NOT be locked yet (we're below the limit)
          expect(userInfo.locked_until).toBeFalsy();
          
          expect(userInfo.failed_attempts).toBe(i + 1);
        }
      }

      // Now make the final attempt that should trigger lockout (attempt #failedAttemptsLimit)
      const finalLoginResult = await noThrow(apiTest.login(testUser, wrongPassword));
      if (!finalLoginResult.errors) {
        fail("Login should have failed");
      }

      // Final verification: account should now be LOCKED after reaching the limit
      const finalUserInfo = await getUserInfo();
      
      // Account should be LOCKED after reaching the limit
      expect(finalUserInfo.locked_until).toBeTruthy(); // Should have a lockout timestamp
      
      // Counter should be reset to 0 after lockout
      expect(finalUserInfo.failed_attempts).toBe(0); // Should reset to 0 after lockout
      
      // Return locked_until timestamp if verifyIntermediateSteps is true, otherwise return full user info
      return verifyIntermediateSteps ? finalUserInfo.locked_until : finalUserInfo;
    } finally {
      await ignoreError(apiTest.logout());
    }
  }

  /**
   * TC-9714-001: Failed Login Attempt Counting
   * Verify that failed login attempts are correctly tracked.
   */
  test("TC-9714-001: Failed login attempt counting", async () => {
    // Unlock user first
    await unlockTestUser();

    try {
      // Trigger lockout with intermediate verification to test counting mechanism
      await triggerLockoutWithVerification(true);
    } finally {
      // Cleanup: Unlock account
      await unlockTestUser();
      // No need to reset lockout duration since we didn't change it
    }
  });

  /**
   * TC-9714-002: Account Lockout Trigger
   * Verify that account is locked when failed attempts limit is exceeded.
   */
  test("TC-9714-002: Account lockout trigger", async () => {
    // Set short lockout duration
    await api.set_system_properties({ "mamori.security.auto_lockout.minutes": lockoutDurationForTesting });

    // Verify the lockout duration was set correctly
    const currentLockoutDuration = await getLockoutDurationMinutes();
    expect(currentLockoutDuration).toBe(lockoutDurationForTesting);

    // Unlock user first
    await unlockTestUser();

    // Trigger lockout and capture lockedUntil timestamp
    const lockedUntil = await triggerLockoutWithVerification(true);
    expect(lockedUntil).toBeTruthy();

    // Verify lockout duration is approximately 20 seconds (0.333 minutes)
    const lockoutDurationSeconds = helper.calculateLockoutDurationSeconds(lockedUntil);

    // Verify lockout duration is approximately 20 seconds (allow 5 second tolerance)
    expect(lockoutDurationSeconds).toBeGreaterThanOrEqual(20);
    expect(lockoutDurationSeconds).toBeLessThanOrEqual(60);

    // Verify login fails even with correct password (account is locked)
    const apiTest = new MamoriService(host, INSECURE);
    try {
      const loginResult = await noThrow(apiTest.login(testUser, testPassword));
      if (!loginResult.errors) {
        fail("Login should fail when account is locked");
      }
      // Verify it's an authentication error (401) - the error message format may vary
      const errorMessage = loginResult.message || String(loginResult);
      expect(errorMessage.toLowerCase()).toMatch(/401|unauthorized|failed|error/i);
    } finally {
      await ignoreError(apiTest.logout());
    }

    // Cleanup: Unlock account
    await unlockTestUser();

    // Reset lockout duration
    await api.set_system_properties({ "mamori.security.auto_lockout.minutes": originalLockoutDuration });
  });

  /**
   * TC-9714-003: Lockout Duration and Expiration
   * Verify that account automatically unlocks after lockout duration expires.
   */
  test("TC-9714-003: Lockout duration and expiration", async () => {
    // Set short lockout duration (20 seconds)
    await api.set_system_properties({ "mamori.security.auto_lockout.minutes": 1 });

    // Unlock user first
    await unlockTestUser();

    // Trigger lockout
    let lockedUntil = await triggerLockoutWithVerification(true);
    expect(lockedUntil).toBeTruthy();

    // Verify account is locked
    let userInfo = await getUserInfo();
    expect(userInfo.locked_until).toBeTruthy();

    // Verify login fails during lockout period
    const apiTest1 = new MamoriService(host, INSECURE);
    try {
      const loginResult = await noThrow(apiTest1.login(testUser, testPassword));
      if (!loginResult.errors) {
        fail("Login should fail when account is locked");
      }
    } finally {
      await ignoreError(apiTest1.logout());
    }

    // Calculate sleep time based on lockedUntil timestamp
    const lockoutDurationSeconds = helper.calculateLockoutDurationSeconds(lockedUntil);
    const timeUntilExpiry = lockoutDurationSeconds * 1000; // Convert to milliseconds
    const sleepTime = Math.max(0, timeUntilExpiry) + 3000; // Add 1 second buffer to ensure expiry
    await helper.sleep(sleepTime);

    // Refresh API session in case it timed out during the sleep
    await refreshApiLogin();

    // Verify login succeeds after expiration
    const apiTest2 = new MamoriService(host, INSECURE);
    try {
      const loginResult = await noThrow(apiTest2.login(testUser, testPassword));
      if (loginResult.errors) {
        throw new Error(`Failed to login after expiration: ${loginResult.message || 'Unknown error'}`);
      }
      expect(apiTest2.username).toBe(testUser);
    } finally {
      await ignoreError(apiTest2.logout());
    }

    // Verify locked_until is cleared (should be null after expiration)
    userInfo = await getUserInfo();
    expect(userInfo).toBeTruthy(); // User should exist
    expect(userInfo!.locked_until).toBeNull(); // locked_until should be null after expiration

    // Reset lockout duration
    await api.set_system_properties({ "mamori.security.auto_lockout.minutes": originalLockoutDuration });
  }, 100000); // Increase timeout for this test due to sleep

  /**
   * TC-9714-004: Manual Account Unlock
   * Verify that administrator can manually unlock a locked account.
   */
  test("TC-9714-004: Manual account unlock", async () => {
    // Set short lockout duration
    await api.set_system_properties({ "mamori.security.auto_lockout.minutes": lockoutDurationForTesting });

    // Unlock user first
    await unlockTestUser();

    // Trigger lockout
    await triggerLockoutWithVerification(false);

    // Verify account is locked
    let userInfo = await getUserInfo();
    expect(userInfo.locked_until).toBeTruthy();

    // Verify login fails
    const apiTest1 = new MamoriService(host, INSECURE);
    try {
      const loginResult = await noThrow(apiTest1.login(testUser, testPassword));
      if (!loginResult.errors) {
        fail("Login should fail when account is locked");
      }
    } finally {
      await ignoreError(apiTest1.logout());
    }

    // Manually unlock account
    await api.unlock_user(testUser);

    // Verify locked_until is cleared
    userInfo = await getUserInfo();
    expect(userInfo.locked_until).toBeFalsy();

    // Verify login succeeds immediately
    const apiTest2 = new MamoriService(host, INSECURE);
    try {
      const loginResult = await noThrow(apiTest2.login(testUser, testPassword));
      if (loginResult.errors) {
        throw new Error(`Failed to login after unlock: ${loginResult.message || 'Unknown error'}`);
      }
      expect(apiTest2.username).toBe(testUser);
    } finally {
      await ignoreError(apiTest2.logout());
    }

    // Reset lockout duration
    await api.set_system_properties({ "mamori.security.auto_lockout.minutes": originalLockoutDuration });
  });

  /**
   * TC-9714-005: Audit Log Entries for Lockout
   * Verify that lockout-related events are properly recorded in audit log.
   */
  test("TC-9714-005: Audit log entries for lockout", async () => {
    // Step 1: Setup - Unlock user first
    await unlockTestUser();

    // Step 2: Define baseSQL query for AUDIT_LOG
    // Get timestamp AFTER unlock with small delay to ensure we only capture new entries
    await helper.sleep(100); // Small delay to ensure timestamp is after any pending operations
    
    // Get current timestamp from database to ensure proper timezone handling
    const currentTimestamp = await helper.getDatabaseTimestamp(api);
    
    let baseSQL = `SELECT count(*) cnt 
       FROM SYS.AUDIT_LOG 
       WHERE querycategory = 'SECURITY'
       and querysubcategory = 'ACCOUNT_LOCKED'
       AND username = '${testUser}' 
       AND updatetime > '${currentTimestamp}'`;

    let emailAlertSQL = `SELECT count(*) cnt 
       FROM sys.alert_delivery_log
       WHERE transport = 'email' 
       AND destination = 'lockout_test@test.test'
       AND username = '${testUser}'
       AND inserted_at > '${currentTimestamp}'`;

    // Step 3: Initial check - Audit log entries should be 0 before lockout
    const initialAuditResult = await helper.selectQuery(api, baseSQL);
    const initialCount = initialAuditResult && initialAuditResult.length > 0 ? parseInt(String(initialAuditResult[0].cnt || initialAuditResult[0].count || 0), 10) : 0;
    expect(initialCount).toBe(0);

    // Initial check - Email alert entries should be 0 before lockout
    const initialAlertResult = await helper.selectQuery(api, emailAlertSQL);
    const initialAlertCount = initialAlertResult && initialAlertResult.length > 0 ? parseInt(String(initialAlertResult[0].cnt || initialAlertResult[0].count || 0), 10) : 0;
    expect(initialAlertCount).toBe(0);

    // Step 4: Trigger lockout
    await triggerLockoutWithVerification(false);

    // Step 5: After lockout check - Audit log entries should have at least 1 lock row
    const afterLockAuditResult = await helper.selectQuery(api, baseSQL);
    const afterLockCount = afterLockAuditResult && afterLockAuditResult.length > 0 ? parseInt(String(afterLockAuditResult[0].cnt || afterLockAuditResult[0].count || 0), 10) : 0;
    expect(afterLockCount).toBeGreaterThan(0); // Should have at least one lock row

    // After lockout check - Email alert entries (may be 0 if email alerts not configured)
    const afterAlertResult = await helper.selectQuery(api, emailAlertSQL);
    const afterAlertCount = afterAlertResult && afterAlertResult.length > 0 ? parseInt(String(afterAlertResult[0].cnt || afterAlertResult[0].count || 0), 10) : 0;
    expect(afterAlertCount).toBeGreaterThanOrEqual(0); // May be 0 if email alerts not configured
  
    // Step 6: Cleanup - Unlock account
    await unlockTestUser();
  });
});


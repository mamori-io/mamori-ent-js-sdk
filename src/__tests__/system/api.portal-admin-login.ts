/**
 * Admin login via Phoenix POST /sessions/login with application "Mamori Portal Login".
 * That matches Login.vue and triggers Hub set_web_portal_login_access() (resource_access_type),
 * not merely a cosmetic application string on an API-style pool.
 *
 * Env: source working/local.sh (MAMORI_SERVER / MAMORI_USERNAME / MAMORI_PASSWORD).
 */
import { MamoriService } from "../../api";
import { ignoreError } from "../../utils";
import {
  INSECURE_HTTPS,
  PORTAL_LOGIN_APPLICATION,
  isApiError,
} from "../../__utility__/auth-test-harness";

const host = process.env.MAMORI_SERVER || "";
const username = process.env.MAMORI_USERNAME || "";
const password = process.env.MAMORI_PASSWORD || "";

const gated = host && username && password ? describe : describe.skip;

gated("portal admin login (Login.vue path)", () => {
  const api = new MamoriService(host, INSECURE_HTTPS);

  afterAll(async () => {
    await ignoreError(api.logout());
  });

  test(
    "Mamori Portal Login as admin then my/sessions (+ validation if restricted)",
    async () => {
      const loginResult = await api.login(
        username,
        password,
        undefined,
        PORTAL_LOGIN_APPLICATION,
      );

      expect(isApiError(loginResult)).toBe(false);
      expect((loginResult as any).username || (loginResult as any).name).toBeTruthy();

      if ((loginResult as any).restricted) {
        const validation = await api.user_has_pending_validation();
        expect(validation).toBeDefined();
      }

      const sessions = await api.get_my_pending_sessions();
      expect(sessions).toBeDefined();
      expect(Array.isArray(sessions) || typeof sessions === "object").toBe(true);
    },
    5000,
  );
});

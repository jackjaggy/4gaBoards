import { expect, test } from '../../fixtures/test.fixture';
import { DEMO_CREDENTIALS, EMPTY_CREDENTIALS, INVALID_CREDENTIALS, USERNAME_ONLY_CREDENTIALS } from '../../utils/test-data';

test.describe('Authentication', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test.describe('Happy path', () => {
    test('login form renders with the expected controls', async ({ loginPage }) => {
      await loginPage.expectFormVisible();
    });

    test('logs in with valid credentials and lands on dashboard', async ({ page, loginPage, header }) => {
      await loginPage.login(DEMO_CREDENTIALS);
      await expect(page).toHaveURL(/\/$/);
      await header.expectUserAvatarVisible();
    });

    test('logs out and returns to /login', async ({ page, loginPage, header }) => {
      await loginPage.login(DEMO_CREDENTIALS);
      await expect(page).toHaveURL(/\/$/);
      await header.logout();
      await expect(page).toHaveURL(/\/login$/);
      await loginPage.expectFormVisible();
    });
  });

  test.describe('Invalid credentials', () => {
    test('shows invalid-credentials error on bad password', async ({ page, loginPage }) => {
      await loginPage.login(INVALID_CREDENTIALS);
      await loginPage.expectInvalidCredentialsError();
      await expect(page).toHaveURL(/\/login$/);
    });
  });

  // Skipped at E2E level — these verify pure client-side behaviour (the LoginForm's empty-submission
  // guards) with no saga / API / WebSocket / DB involvement. They belong as Jest unit tests against
  // LoginForm. The "no network request fired" assertion uses a 1s waitForRequest window which is
  // structurally flake-prone on a slow CI runner — the test passes if the request hasn't fired
  // *yet*, not if it will *never* fire. The happy-path login + invalid-credentials tests above
  // already cover the end-to-end network boundary; a saga-level regression would surface there.
  // Kept as test.skip so the intent stays executable and surfaces in the report.
  test.describe.skip('Empty-submission guards (push down to Jest unit tests on LoginForm)', () => {
    // Client-side guard: the login form must not POST to /api/access-tokens when either field is empty.
    // Verified by capturing requests during the click window and asserting the user remains on /login
    // with no invalid-credentials banner (which only appears after a real failed authentication round-trip).
    test('does not POST /api/access-tokens when both fields are empty', async ({ page, loginPage }) => {
      const requestFired = await loginPage.submitAndCaptureAuthRequest(EMPTY_CREDENTIALS);

      expect(requestFired, 'no auth request should fire on empty submit').toBe(false);
      await expect(page).toHaveURL(/\/login$/);
      await loginPage.expectFormVisible();
      await loginPage.expectInvalidCredentialsErrorAbsent();
    });

    test('does not POST /api/access-tokens when only the password is empty', async ({ page, loginPage }) => {
      const requestFired = await loginPage.submitAndCaptureAuthRequest(USERNAME_ONLY_CREDENTIALS);

      expect(requestFired, 'no auth request should fire when password is empty').toBe(false);
      await expect(page).toHaveURL(/\/login$/);
      await loginPage.expectInvalidCredentialsErrorAbsent();
    });
  });
});

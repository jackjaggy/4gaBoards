import { expect, type Locator, type Page } from '@playwright/test';
import { Buttons, Headings, InputNames } from '../utils/labels';
import { ErrorMessages } from '../utils/messages';
import type { Credentials } from '../utils/test-data';
import { BasePage } from './base.page';

const ACCESS_TOKEN_ENDPOINT = /\/api\/access-tokens/;

export class LoginPage extends BasePage {
  readonly heading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly invalidCredentialsError: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: Headings.login, level: 1 });
    // Login inputs have no label / aria-label / placeholder, so we target the React `name` attribute,
    // which is the only stable handle.
    this.usernameInput = page.locator(`input[name="${InputNames.emailOrUsername}"]`);
    this.passwordInput = page.locator(`input[name="${InputNames.password}"]`);
    this.submitButton = page.getByRole('button', { name: Buttons.logIn });
    this.invalidCredentialsError = page.getByText(ErrorMessages.invalidCredentials);
  }

  async goto(): Promise<void> {
    await this.navigate('/login');
  }

  async login(credentials: Credentials): Promise<void> {
    await this.usernameInput.fill(credentials.username);
    await this.passwordInput.fill(credentials.password);
    await this.submitButton.click();
  }

  // Submit while expecting the client-side guard to short-circuit the request.
  // Listens for the auth POST during a short window; returns whether one fired.
  async submitAndCaptureAuthRequest(credentials: Credentials): Promise<boolean> {
    await this.usernameInput.fill(credentials.username);
    await this.passwordInput.fill(credentials.password);
    const authRequest = this.page
      .waitForRequest(
        (req) => ACCESS_TOKEN_ENDPOINT.test(req.url()) && req.method() === 'POST',
        { timeout: 1000 },
      )
      .catch(() => null);
    await this.submitButton.click();
    return (await authRequest) !== null;
  }

  async expectFormVisible(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await expect(this.invalidCredentialsError).toBeVisible();
  }

  async expectInvalidCredentialsErrorAbsent(): Promise<void> {
    await expect(this.invalidCredentialsError).toHaveCount(0);
  }
}

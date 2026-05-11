import { expect, type Locator, type Page } from '@playwright/test';
import { Buttons } from '../utils/labels';
import { DEMO_USER_INITIALS } from '../utils/test-data';

// Header is a cross-page component, not a route — exposed as a Page Object that operates on `page`
// without a goto(). Used by tests after login to drive logout and to assert logged-in chrome.
export class HeaderComponent {
  readonly page: Page;
  readonly userAvatar: Locator;
  readonly userPopup: Locator;
  readonly logOutButton: Locator;

  constructor(page: Page, initials: string = DEMO_USER_INITIALS) {
    this.page = page;
    this.userAvatar = page.getByRole('button', { name: initials, exact: true });
    this.userPopup = page.getByRole('dialog');
    this.logOutButton = this.userPopup.getByRole('button', { name: Buttons.logOut });
  }

  async expectUserAvatarVisible(): Promise<void> {
    await expect(this.userAvatar).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.userAvatar.click();
    await this.logOutButton.click();
  }
}

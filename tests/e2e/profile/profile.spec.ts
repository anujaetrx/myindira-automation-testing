import path from 'node:path';
import { test, expect } from '@fixtures';
import { ProfilePage } from '@pages/ProfilePage';
import { DataProvider } from '@data/DataProvider';
import { Tags } from '@utils/constants';

const AVATAR = path.resolve(__dirname, '../../../src/test-data/files/avatar.png');

// Specs describe BUSINESS scenarios. All clicking/typing lives in page objects.
test.describe('Profile', () => {
  // These two tests were written as generic placeholders for an assumed app: they use a `userPage` (student/employee
  // login) that does not exist for this QA tenant (only ADMIN credentials) and form fields (first/last name, country,
  // avatar-upload test id) that the admin portal does not have (its only profile UI is the avatar menu: name, role,
  // e-mail, Logout; see tests/e2e/IUN3224-LoginSSO/IUN3224-session.spec.ts). Skipped on purpose, see docs/test-cases/login-sso.md.
  test.beforeEach(() => {
    test.skip(true, 'Placeholder profile tests: no student/employee account and no editable profile form in the admin portal.');
  });

  test(`user can update their name ${Tags.regression}`, async ({ userPage }) => {
    const profile = new ProfilePage(userPage);
    const { firstName, lastName } = DataProvider.profileUpdate();

    await profile.goto();
    await profile.updateName(firstName, lastName);

    await expect(profile.toast.locator).toBeVisible();
    await profile.reload(); // proves the change was persisted, not just shown
    await profile.expectSavedName(firstName, lastName);
  });

  test(`user can change country and upload an avatar ${Tags.regression}`, async ({ userPage }) => {
    const profile = new ProfilePage(userPage);

    await profile.goto();
    await profile.chooseCountry('India');
    await profile.uploadAvatar(AVATAR);
    await profile.save();

    await expect(profile.toast.locator).toBeVisible();
  });
});

import type { User } from '@api/models/user.model';
import { UserFactory } from '@data/factories/UserFactory';
import { apiTest } from './api.fixture';

type DataFixtures = {
  /** A user created through the API and deleted after the test. */
  createdUser: User;
};

export const dataTest = apiTest.extend<DataFixtures>({
  createdUser: async ({ userApi }, use) => {
    const result = await userApi.create(UserFactory.build());
    if (!result.ok) throw new Error(`Test-data setup failed: create user returned ${result.status}`);
    const user = await result.body();
    await use(user);
    await userApi.remove(user.id); // cleanup keeps shared environments tidy
  },
});

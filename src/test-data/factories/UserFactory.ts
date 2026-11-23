import { faker } from '@faker-js/faker';
import type { CreateUserRequest } from '@api/models/user.model';
import { StringHelper } from '@utils/helpers/string.helper';

export const UserFactory = {
  /** Unique per call, so parallel workers never collide. */
  build(overrides: Partial<CreateUserRequest> = {}): CreateUserRequest {
    const suffix = StringHelper.uniqueSuffix();
    return {
      username: `auto_${suffix}`,
      email: `auto_${suffix}@example.com`,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: 'user',
      password: `Pw!${faker.string.alphanumeric(12)}`,
      ...overrides,
    };
  },
};

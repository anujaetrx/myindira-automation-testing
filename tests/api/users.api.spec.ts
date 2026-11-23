import { test, expect } from '@fixtures';
import { userSchema } from '@api/schemas/user.schema';
import { UserFactory } from '@data/factories/UserFactory';
import { HttpStatus, Tags } from '@utils/constants';

test.describe(`Users API ${Tags.api}`, () => {
  test('GET /users/:id returns a contract-valid user', async ({ userApi, createdUser }) => {
    const result = await userApi.getById(createdUser.id);
    expect(result.status).toBe(HttpStatus.ok);
    const body = await result.body(userSchema);
    expect(body.id).toBe(createdUser.id);
  });

  test('POST /users creates a user and DELETE removes it', async ({ userApi }) => {
    const payload = UserFactory.build();
    const created = await userApi.create(payload);
    expect(created.status).toBe(HttpStatus.created);
    const user = await created.body(userSchema);

    const removed = await userApi.remove(user.id);
    expect(removed.status).toBe(HttpStatus.noContent);
    expect((await userApi.getById(user.id)).status).toBe(HttpStatus.notFound);
  });

  test('unauthenticated request is rejected', async ({ authApi, apiContext }) => {
    void authApi;
    const res = await apiContext.get('/users');
    expect(res.status()).toBe(HttpStatus.unauthorized);
  });
});

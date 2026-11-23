import { test, expect } from '@fixtures';
import { orderSchema } from '@api/schemas/user.schema';
import { OrderFactory } from '@data/factories/OrderFactory';
import { HttpStatus, Tags } from '@utils/constants';

test.describe(`Orders API ${Tags.api}`, () => {
  test('create then fetch an order', async ({ orderApi }) => {
    const created = await orderApi.create(OrderFactory.build(2));
    expect(created.status).toBe(HttpStatus.created);
    const order = await created.body(orderSchema);

    const fetched = await orderApi.getById(order.id);
    expect(fetched.response).toBeOkResponse();
    expect((await fetched.body(orderSchema)).id).toBe(order.id);
  });
});

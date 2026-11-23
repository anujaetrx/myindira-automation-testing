import { faker } from '@faker-js/faker';
import type { CreateOrderRequest, OrderItem } from '@api/models/order.model';

export const OrderFactory = {
  item(overrides: Partial<OrderItem> = {}): OrderItem {
    return {
      sku: `SKU-${faker.string.alphanumeric(6).toUpperCase()}`,
      quantity: faker.number.int({ min: 1, max: 5 }),
      unitPrice: Number(faker.commerce.price({ min: 1, max: 100 })),
      ...overrides,
    };
  },
  build(itemCount = 1): CreateOrderRequest {
    return { items: Array.from({ length: itemCount }, () => OrderFactory.item()) };
  },
};

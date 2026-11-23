import type { OrderItem } from '@api/models/order.model';
import type { Credentials } from '@api/models/common.model';
import users from './static/users.json';
import products from './static/products.json';

/** Single access point for static data, so specs never import JSON files directly. */
export const DataProvider = {
  invalidLogin: (): Credentials => users.invalidLogin,
  profileUpdate: (): { firstName: string; lastName: string } => users.profileUpdate,
  defaultOrderItems: (): OrderItem[] => products.defaults,
};

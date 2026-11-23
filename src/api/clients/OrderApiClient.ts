import type { CreateOrderRequest, Order } from '../models/order.model';
import { BaseApiClient, type ApiResult } from './BaseApiClient';

export class OrderApiClient extends BaseApiClient {
  create(payload: CreateOrderRequest): Promise<ApiResult<Order>> {
    return this.post('/orders', payload);
  }
  getById(id: string): Promise<ApiResult<Order>> {
    return this.get(`/orders/${id}`);
  }
  cancel(id: string): Promise<ApiResult<Order>> {
    return this.post(`/orders/${id}/cancel`);
  }
}

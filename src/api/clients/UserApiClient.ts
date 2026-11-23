import type { CreateUserRequest, UpdateUserRequest, User } from '../models/user.model';
import type { Paginated } from '../models/common.model';
import { BaseApiClient, type ApiResult } from './BaseApiClient';

export class UserApiClient extends BaseApiClient {
  list(page = 1, pageSize = 20): Promise<ApiResult<Paginated<User>>> {
    return this.get('/users', { params: { page, pageSize } });
  }
  getById(id: string): Promise<ApiResult<User>> {
    return this.get(`/users/${id}`);
  }
  me(): Promise<ApiResult<User>> {
    return this.get('/users/me');
  }
  create(payload: CreateUserRequest): Promise<ApiResult<User>> {
    return this.post('/users', payload);
  }
  update(id: string, payload: UpdateUserRequest): Promise<ApiResult<User>> {
    return this.patch(`/users/${id}`, payload);
  }
  remove(id: string): Promise<ApiResult<void>> {
    return this.delete(`/users/${id}`);
  }
}

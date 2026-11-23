import { env, type Credentials } from '@config/environment';
import type { LoginResponse } from '../models/user.model';
import type { User } from '../models/user.model';
import { BaseApiClient, type ApiResult } from './BaseApiClient';

export class AuthApiClient extends BaseApiClient {
  login(credentials: Credentials): Promise<ApiResult<LoginResponse>> {
    return this.post<LoginResponse>(env.auth.loginEndpoint, credentials);
  }

  /** Server-side session invalidation. Requires the client to be built with the session token. */
  logout(): Promise<ApiResult<void>> {
    return this.post<void>(env.auth.logoutEndpoint);
  }

  /** Cheap authenticated call used to ask the server "is this token still good?". */
  me(): Promise<ApiResult<User>> {
    return this.get<User>(env.auth.meEndpoint);
  }
}

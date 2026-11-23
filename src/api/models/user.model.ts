export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
}

export type CreateUserRequest = Omit<User, 'id'> & { password: string };
export type UpdateUserRequest = Partial<Omit<User, 'id'>>;

export interface LoginResponse {
  token: string;
  expiresIn?: number;
}

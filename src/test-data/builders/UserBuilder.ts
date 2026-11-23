import type { CreateUserRequest } from '@api/models/user.model';
import { UserFactory } from '../factories/UserFactory';

/** Fluent builder for readable variants: new UserBuilder().asAdmin().withEmail('x').build() */
export class UserBuilder {
  private data: CreateUserRequest = UserFactory.build();

  asAdmin(): this {
    this.data.role = 'admin';
    return this;
  }
  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }
  withName(first: string, last: string): this {
    this.data.firstName = first;
    this.data.lastName = last;
    return this;
  }
  build(): CreateUserRequest {
    return { ...this.data };
  }
}

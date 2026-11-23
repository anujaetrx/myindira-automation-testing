import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ZodType } from 'zod';
import { env } from '@config/environment';
import { ApiLogger } from '../interceptors/ApiLogger';

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
}

/**
 * Generic, typed HTTP client over Playwright's APIRequestContext.
 * Domain clients extend this and add only domain methods (SRP / OCP).
 */
export abstract class BaseApiClient {
  protected readonly logger = new ApiLogger();

  constructor(
    protected readonly request: APIRequestContext,
    /** A bearer token, or the full header set the app uses (see AUTH_API_HEADERS). */
    private readonly auth?: string | Record<string, string>,
  ) {}

  protected get<T>(url: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.send<T>('GET', url, undefined, opts);
  }
  protected post<T>(url: string, data?: unknown, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.send<T>('POST', url, data, opts);
  }
  protected put<T>(url: string, data?: unknown, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.send<T>('PUT', url, data, opts);
  }
  protected patch<T>(url: string, data?: unknown, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.send<T>('PATCH', url, data, opts);
  }
  protected delete<T = void>(url: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.send<T>('DELETE', url, undefined, opts);
  }

  private async send<T>(
    method: string,
    url: string,
    data: unknown,
    opts: RequestOptions,
  ): Promise<ApiResult<T>> {
    const headers = {
      ...(typeof this.auth === 'string' ? { Authorization: `Bearer ${this.auth}` } : this.auth),
      ...opts.headers,
    };
    const fullUrl = `${env.apiPathPrefix}${url}`;
    this.logger.request(method, fullUrl, data);
    const start = Date.now();
    const response = await this.request.fetch(fullUrl, { method, data, params: opts.params, headers });
    this.logger.response(method, fullUrl, response, Date.now() - start);
    return new ApiResult<T>(response);
  }
}

/** Wraps a raw response so tests can assert on status and optionally validate the body shape. */
export class ApiResult<T> {
  constructor(readonly response: APIResponse) {}

  get status(): number {
    return this.response.status();
  }
  get ok(): boolean {
    return this.response.ok();
  }

  async body(schema?: ZodType<T>): Promise<T> {
    const json = (await this.response.json()) as unknown;
    return schema ? schema.parse(json) : (json as T);
  }
}

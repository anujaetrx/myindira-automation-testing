import { expect as baseExpect, type APIResponse } from '@playwright/test';

/** Custom matchers shared by all specs. Exported through fixtures/index.ts as `expect`. */
export const expect = baseExpect.extend({
  async toBeOkResponse(response: APIResponse) {
    const pass = response.ok();
    const body = pass ? '' : await response.text().catch(() => '');
    return {
      pass,
      message: () =>
        pass
          ? `Expected response not to be OK`
          : `Expected OK response but got ${response.status()} ${response.url()}\n${body}`,
    };
  },
});

declare module '@playwright/test' {
  interface Matchers<R> {
    toBeOkResponse(): Promise<R>;
  }
}

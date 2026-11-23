import type { Page } from '@playwright/test';

export interface CapturedWrite {
  method: string;
  /** Path after /myindiranew/api, e.g. "/posts/146/react" */
  path: string;
  body: string;
}

/**
 * Stops every write call (POST/PUT/PATCH/DELETE) to the app's API from reaching the server and answers it with
 * a generic success. Returns the list of calls that were attempted, so a test can assert what the screen sent.
 * Reads (GET) pass through untouched. Use it in every test that clicks something that would change data.
 *
 * Do NOT use route.fetch() to build mocked responses: the Node side does not trust the corporate CA and the error
 * log prints request headers (including auth tokens). Build mock JSON by hand instead.
 */
export async function guardWrites(page: Page): Promise<CapturedWrite[]> {
  const writes: CapturedWrite[] = [];
  await page.route(/\/myindiranew\/api\//, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.continue();
    writes.push({ method: req.method(), path: req.url().replace(/^.*\/myindiranew\/api/, '').split('?')[0], body: req.postData() ?? '' });
    return route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: {} } });
  });
  return writes;
}

/** Wraps rows in the API's page envelope, for mocking list calls. */
export function pageResponse(content: unknown[]): object {
  return { success: true, message: 'ok', code: 'OK', data: { totalElements: content.length, totalPages: content.length ? 1 : 0, size: 20, content, empty: content.length === 0 } };
}

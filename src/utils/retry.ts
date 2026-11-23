export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  description?: string;
}

/**
 * Polls until `fn` returns a truthy value, or throws on timeout. For conditions outside the browser
 * (device boot, package installed, activity in foreground) where Playwright's auto-waiting can't help.
 */
export async function pollUntil<T>(fn: () => Promise<T | null | undefined | false>, opts: PollOptions = {}): Promise<T> {
  const { timeoutMs = 30_000, intervalMs = 1_000, description = 'condition' } = opts;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const cause = lastError instanceof Error ? ` (last error: ${lastError.message})` : '';
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}${cause}`);
}

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoff?: number;
  onRetry?: (error: unknown, attempt: number) => void;
}

/** Retry a non-Playwright async operation (e.g. polling a backend). Prefer web-first assertions for UI. */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, delayMs = 500, backoff = 2, onRetry } = opts;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      onRetry?.(error, attempt);
      await new Promise((r) => setTimeout(r, delayMs * backoff ** (attempt - 1)));
    }
  }
  throw lastError;
}

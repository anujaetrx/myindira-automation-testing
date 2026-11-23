/** Thrown when a UI interaction fails. Carries context so failures are diagnosable from the report alone. */
export class UiActionError extends Error {
  constructor(
    readonly action: string,
    readonly target: string,
    readonly pageUrl: string,
    cause: unknown,
  ) {
    const reason = cause instanceof Error ? cause.message.split('\n')[0] : String(cause);
    super(`Could not ${action} ${target} on ${pageUrl}: ${reason}`, { cause });
    this.name = 'UiActionError';
  }
}

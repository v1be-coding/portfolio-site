// Every call to this app's API goes through here, so a limited visitor sees why
// instead of a page that looks broken (Q57).

// A 429 from the app, API Gateway's throttle or Cloudflare. Only the app's own
// carries a JSON body, so the wait relies on Retry-After, except for the chat
// limit, whose body's retryAfterSeconds is what its message promises.
export class RateLimitedError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    readonly reason: "rate_limited" | "chat_rate_limited" | "daily_cap" | "unknown",
  ) {
    super("Too many requests");
  }
}

// `code` is the body's `error` field when there is one, such as `ai_busy`, so a
// caller keys on what the app said rather than on a status that proxies share.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`API answered ${status}`);
  }
}

const DEFAULT_WAIT_SECONDS = 60;

// Retry-After is either seconds or an HTTP date.
export function parseRetryAfter(value: string | null, now: number = Date.now()): number {
  if (!value) return DEFAULT_WAIT_SECONDS;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? DEFAULT_WAIT_SECONDS : Math.max(1, Math.ceil((date - now) / 1000));
}

type ErrorBody = { error?: unknown; retryAfterSeconds?: unknown };

// A proxy's error page isn't JSON, so an unreadable body is just an empty one.
async function errorBody(response: Response): Promise<ErrorBody> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null ? body : {};
  } catch {
    return {};
  }
}

const REASONS = ["rate_limited", "chat_rate_limited", "daily_cap"] as const;

function rateLimited(response: Response, body: ErrorBody): RateLimitedError {
  const reason = REASONS.find((known) => known === body.error) ?? "unknown";
  const bodyWait = body.retryAfterSeconds;
  const wait =
    reason === "chat_rate_limited" && typeof bodyWait === "number" && bodyWait >= 0
      ? Math.ceil(bodyWait)
      : parseRetryAfter(response.headers.get("retry-after"));
  return new RateLimitedError(wait, reason);
}

// Never retries by itself, so a waiting visitor doesn't add to the load.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (response.status === 429) throw rateLimited(response, await errorBody(response));
  if (!response.ok) {
    const { error } = await errorBody(response);
    throw new ApiError(response.status, typeof error === "string" ? error : undefined);
  }
  return (await response.json()) as T;
}

export function limitMessage(error: RateLimitedError): string {
  switch (error.reason) {
    case "daily_cap":
      return "The AI feature is paused until tomorrow.";
    case "chat_rate_limited":
      return `Too many questions. Try again in ${error.retryAfterSeconds} seconds.`;
    default:
      return `Too many requests. Try again in ${error.retryAfterSeconds} seconds.`;
  }
}

// What a line on the page shows in place of its value when a call fails: the
// limit message when rate-limited, otherwise "unavailable".
export function failureText(error: unknown): string {
  return error instanceof RateLimitedError ? limitMessage(error) : "unavailable";
}

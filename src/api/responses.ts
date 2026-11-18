import type { APIGatewayProxyResultV2 } from "aws-lambda";

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Every 429 carries the wait twice, in the header and the body, so a client can
// read either; the client tells the limits apart by `error`.
export function tooManyRequests(
  error: string,
  message: string,
  retryAfterSeconds: number,
): APIGatewayProxyResultV2 {
  return {
    statusCode: 429,
    headers: { "content-type": "application/json", "retry-after": String(retryAfterSeconds) },
    body: JSON.stringify({ error, message, retryAfterSeconds }),
  };
}

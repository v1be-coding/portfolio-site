// What the panel's status region says. Every failure the Chat can meet arrives
// here as an error from ./chat-api.ts, so this is the one place that maps them to
// text.
import { limitMessage, RateLimitedError } from "../api.js";

export type Health = "checking" | "ok" | { error: unknown };

export type StatusInput = { health: Health; pending: boolean; sendError: unknown };

export function statusText({ health, pending, sendError }: StatusInput): string {
  if (typeof health === "object") return healthFailureText(health.error);
  if (pending) return "Thinking…";
  if (sendError) return sendFailureText(sendError);
  return "";
}

function healthFailureText(error: unknown): string {
  return error instanceof RateLimitedError
    ? limitMessage(error)
    : "The Chat is unavailable right now.";
}

function sendFailureText(error: unknown): string {
  return error instanceof RateLimitedError
    ? limitMessage(error)
    : "Your message didn't send. Try again.";
}

// What the panel's status region says. Every failure the Chat can meet arrives
// here as whatever ./chat-api.ts threw, so this is the one place that maps them to
// text: the API's own errors by kind, and anything else (a network TypeError, a
// SyntaxError from a non-JSON body) to the generic text.
import { ApiError, limitMessage, RateLimitedError } from "../api.js";

export type Health = "checking" | "ok" | { error: unknown };

export type StatusInput = { health: Health; pending: boolean; sendError: unknown };

// `offerEmail` asks the panel to add an "Email me instead" link: the only way
// left to reach Emiliano once the AI feature has paused for the day.
export type ChatStatus = { text: string; offerEmail: boolean };

export function chatStatus({ health, pending, sendError }: StatusInput): ChatStatus {
  if (typeof health === "object") return plain(healthFailureText(health.error));
  if (pending) return plain("Thinking…");
  if (sendError) return sendFailureStatus(sendError);
  return plain("");
}

function plain(text: string): ChatStatus {
  return { text, offerEmail: false };
}

function healthFailureText(error: unknown): string {
  return error instanceof RateLimitedError
    ? limitMessage(error)
    : "The Chat is unavailable right now.";
}

function sendFailureStatus(error: unknown): ChatStatus {
  if (error instanceof RateLimitedError) {
    return { text: limitMessage(error), offerEmail: error.reason === "daily_cap" };
  }
  if (error instanceof ApiError && error.code === "ai_busy") {
    return plain("The Chat is busy right now. Try again in a minute.");
  }
  return plain("Your message didn't send. Try again.");
}

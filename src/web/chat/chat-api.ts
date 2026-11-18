// The Chat's two calls. Both go through ../api.ts, so a failure reaches the panel
// as a RateLimitedError, an ApiError, a TypeError from fetch when the network
// fails, or a SyntaxError when a 2xx body isn't JSON. ./status.ts maps the last
// two, and anything else, to the generic text.
import { api, ApiError } from "../api.js";
import type { Message } from "./conversation.js";

export async function checkHealth(signal?: AbortSignal): Promise<void> {
  await api<unknown>("/api/health", { signal });
}

export async function askChat(messages: readonly Message[]): Promise<string> {
  const { reply } = await api<{ reply?: unknown }>("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  // An empty or missing reply can't be shown or sent back, so it counts as a failed send.
  if (typeof reply !== "string" || reply.length === 0) throw new ApiError(200);
  return reply;
}

import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { json, tooManyRequests } from "../api/responses.js";
import { claude, classifyClaudeError } from "../ai/claude.js";
import { content } from "../content/content.js";
import { limitsConfig } from "../limits/config.js";
import { spendCapResponse } from "../limits/guard.js";
import { checkRateLimit, type RateLimit, type RateLimitResult } from "../limits/rate-limit.js";
import {
  costUsd,
  type Prices,
  secondsUntilNextDay,
  type Usage,
  withSpendCap,
  worstCaseUsd,
} from "../limits/spend-cap.js";
import { store, type Store } from "../limits/store.js";
import { DECLINE_LINE, systemPrompt } from "./prompt.js";
import { type ChatMessage, MAX_ASSISTANT_LENGTH, parseConversation } from "./validate.js";

const MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 500;
// Haiku 5.5, per million tokens, from Anthropic's pricing page.
const PRICES: Prices = { input: 0.1, output: 0.5 };

type ModelReply = {
  content: readonly { type: string; text?: string }[];
  stop_reason: string | null;
  usage: Usage;
};

// The slice of the Anthropic client the route uses, so tests can pass a stub.
export type ModelClient = {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      thinking: { type: "disabled" };
      system: string;
      messages: ChatMessage[];
    }): Promise<ModelReply>;
  };
};

export type ChatRequest = { method: string; body: string | undefined; callerHash: string };

export type ChatDeps = {
  client: () => Promise<ModelClient>;
  db: Store;
  table: string;
  target: string;
  capUsd: number;
  now: () => number;
};

function defaultDeps(): ChatDeps {
  const config = limitsConfig();
  return {
    client: claude,
    db: store(),
    table: config.table,
    target: config.target,
    capUsd: config.dailyCapUsd,
    now: Date.now,
  };
}

const SYSTEM = systemPrompt(content);

export async function chatRoute(
  request: ChatRequest,
  deps: ChatDeps = defaultDeps(),
): Promise<APIGatewayProxyResultV2> {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const limited = await checkChatLimit(request.callerHash, deps);
  if (limited) return limited;

  const messages = parseConversation(request.body);
  if (!messages) return json(400, { error: "invalid_request", message: "Invalid conversation" });

  const now = deps.now();
  const started = Date.now();
  try {
    const result = await withSpendCap(
      worstCaseUsd(inputTokenBound(messages), MAX_TOKENS, PRICES),
      async () => {
        const client = await deps.client();
        const reply = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: "disabled" },
          system: SYSTEM,
          messages,
        });
        return { value: reply, costUsd: costUsd(reply.usage, PRICES) };
      },
      { db: deps.db, table: deps.table, capUsd: deps.capUsd, now },
    );
    if (!result.ok) {
      logOutcome({ outcome: "daily_cap", durationMs: Date.now() - started });
      return spendCapResponse(result.retryAfterSeconds);
    }

    const { usage, stop_reason } = result.value;
    logOutcome({
      outcome: "ok",
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      stopReason: stop_reason,
      durationMs: Date.now() - started,
    });
    return json(200, { reply: replyText(result.value) });
  } catch (error) {
    const failure = classifyClaudeError(error);
    const durationMs = Date.now() - started;
    if (failure === "spend_limit") {
      logOutcome({ outcome: failure, durationMs });
      return spendCapResponse(secondsUntilNextDay(now));
    }
    if (failure === "rate_limit" || failure === "overloaded" || failure === "timeout") {
      logOutcome({ outcome: failure, durationMs });
      return json(503, { error: "ai_busy", message: "The AI is busy. Try again in a minute." });
    }
    // A person has to look at these (docs/calling-claude.md), so they log as
    // errors, with the error's class and status to go on.
    logOutcome({ outcome: failure, durationMs, ...errorMetadata(error) }, "error");
    return serverError();
  }
}

function serverError(): APIGatewayProxyResultV2 {
  return json(500, { error: "server_error", message: "Something went wrong" });
}

// The error's class and status only: an SDK error's message can quote the API's
// response, and logs hold metadata only (spec #2, Logging).
function errorMetadata(error: unknown): { errorName?: string; status?: number } {
  if (!(error instanceof Error)) return {};
  const status = (error as { status?: unknown }).status;
  // The SDK's classes all keep `name` as "Error", so the class tells them apart.
  return { errorName: error.constructor.name, ...(typeof status === "number" ? { status } : {}) };
}

// The reservation must never be too small. Text like this runs well under one
// token per character, so two per character is a safe ceiling, and the real
// cost is settled after the call.
function inputTokenBound(messages: readonly ChatMessage[]): number {
  const characters = messages.reduce((sum, message) => sum + message.content.length, SYSTEM.length);
  return 2 * characters;
}

// A refused or cut-off reply goes back as it is (spec #2). A reply with no text
// at all would be an empty string the client couldn't send back, so it gets the
// decline line. Bounded like an assistant message, so any reply can be resent.
function replyText(reply: ModelReply): string {
  const text = reply.content
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("");
  return (text || DECLINE_LINE).slice(0, MAX_ASSISTANT_LENGTH);
}

// Metadata only: never the visitor's text or the reply (spec #2, Logging).
function logOutcome(
  fields: {
    outcome: string;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    stopReason?: string | null;
    errorName?: string;
    status?: number;
  },
  level: "log" | "error" = "log",
): void {
  console[level](JSON.stringify({ route: "chat", ...fields }));
}

// Spec #2, Terms: an hour on production, and a minute elsewhere, because a
// branch's fix rounds rerun the whole suite within the same hour.
function chatLimit(target: string): RateLimit {
  return { name: "chat", requests: 20, windowSeconds: target === "production" ? 3600 : 60 };
}

// Counts every POST, valid or not, so malformed requests can't probe for free.
async function checkChatLimit(
  callerHash: string,
  deps: ChatDeps,
): Promise<APIGatewayProxyResultV2 | undefined> {
  let result: RateLimitResult;
  try {
    result = await checkRateLimit(
      deps.db,
      deps.table,
      callerHash,
      deps.now(),
      chatLimit(deps.target),
    );
  } catch (error) {
    // A counter that can't answer hasn't said "under the limit", and the spec
    // counts every POST, so the request is refused rather than let through.
    logOutcome({ outcome: "rate_limit_error", ...errorMetadata(error) }, "error");
    return serverError();
  }
  if (result.allowed) return undefined;
  const seconds = result.retryAfterSeconds;
  return tooManyRequests(
    "chat_rate_limited",
    `Too many questions. Try again in ${seconds} seconds.`,
    seconds,
  );
}

// AInakupo SDK: reports one AI call (a trace) to AInakupo.
//
// Copy this file into your app and compile it with your own TypeScript. It is
// served at /sdk/ainakupo.ts (ADR-0004), so it stays one file of erasable
// TypeScript with `node:` imports only, and imports nothing from the app.
//
//   const ainakupo = createAInakupo({ endpoint: "https://ainakupo.emilianocasijr.com", ingestKey });
//   const result = await ainakupo.send({ provider: "anthropic", model, feature: "summary",
//     ...fromAnthropicUsage(message.usage), startedAt, durationMs, status: "ok" });
//
// `send` makes one POST per trace, never retries, and never throws or rejects:
// every outcome is a `SendResult`. Await it, since a serverless host may freeze
// once the handler returns. The ingest key stays in a closure, so it is never on
// the client object or in a result, and the SDK never logs or reads the environment.

import { randomUUID } from "node:crypto";

export type TraceInput = {
  id?: string;
  runId?: string | null;
  provider: string;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  startedAt: Date | string;
  durationMs: number;
  costUsd?: number | null;
  status: "ok" | "error";
  prompt?: string;
  response?: string;
};

export type SendFailure =
  | "invalid_config"
  | "invalid_trace"
  | "invalid_key"
  | "trace_conflict"
  | "key_rate_limited"
  | "rate_limited"
  | "server_error"
  | "unexpected_response"
  | "timeout"
  | "network";

export type SendResult =
  | { ok: true; id: string; status: 200 | 201; hasText: boolean; textTruncated: boolean }
  | {
      ok: false;
      id: string;
      reason: SendFailure;
      status?: number;
      field?: string;
      retryAfterSeconds?: number;
    };

const TRACE_FIELDS = [
  "id",
  "runId",
  "provider",
  "model",
  "feature",
  "inputTokens",
  "outputTokens",
  "startedAt",
  "durationMs",
  "costUsd",
  "status",
  "prompt",
  "response",
] as const satisfies readonly (keyof TraceInput)[];

const KEY_FORMAT = /^aik_(prod|prev)_[A-Za-z0-9_-]{43}$/;
// The only hosts allowed over plain http:, since traffic to them never leaves the machine.
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const DEFAULT_TIMEOUT_MS = 2_000;

export function createAInakupo(options: {
  endpoint: string;
  ingestKey: string;
  timeoutMs?: number;
}): {
  send(trace: TraceInput): Promise<SendResult>;
} {
  // Checked once, here; a bad config is reported by every send rather than thrown.
  const config = checkConfig(options);
  const send = async (trace: TraceInput): Promise<SendResult> => {
    let id = "";
    try {
      id = traceId(trace);
      if (!config) return { ok: false, id, reason: "invalid_config" };
      return await post(config, id, trace);
    } catch {
      // Unreachable by design; kept so send can never reject.
      return { ok: false, id, reason: "network" };
    }
  };
  return Object.freeze({ send });
}

export function fromAnthropicUsage(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens:
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}

type Config = { url: string; authorization: string; timeoutMs: number };

function checkConfig(options: unknown): Config | null {
  try {
    if (typeof options !== "object" || options === null) return null;
    const {
      endpoint,
      ingestKey,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = options as Record<string, unknown>;
    if (
      typeof endpoint !== "string" ||
      typeof ingestKey !== "string" ||
      !KEY_FORMAT.test(ingestKey)
    )
      return null;
    if (
      typeof timeoutMs !== "number" ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 100 ||
      timeoutMs > 10_000
    ) {
      return null;
    }
    if (!URL.canParse(endpoint)) return null;
    const origin = new URL(endpoint);
    if (origin.username || origin.password) return null;
    const secure = origin.protocol === "https:";
    const loopback = origin.protocol === "http:" && LOOPBACK_HOSTS.includes(origin.hostname);
    if (!secure && !loopback) return null;
    const url = new URL(`${origin.pathname.replace(/\/$/, "")}/api/traces`, origin.origin).href;
    return { url, authorization: `Bearer ${ingestKey}`, timeoutMs };
  } catch {
    return null;
  }
}

function traceId(trace: TraceInput): string {
  const given = (trace as Partial<TraceInput> | null | undefined)?.id;
  return given === undefined ? randomUUID() : given;
}

// Only the TraceInput fields, with a Date startedAt as its ISO string.
function traceBody(trace: TraceInput, id: string): string {
  const body: Record<string, unknown> = {};
  for (const field of TRACE_FIELDS) {
    const value = field === "id" ? id : trace[field];
    if (value === undefined) continue;
    body[field] =
      value instanceof Date ? (Number.isNaN(value.getTime()) ? null : value.toISOString()) : value;
  }
  return JSON.stringify(body);
}

async function post(config: Config, id: string, trace: TraceInput): Promise<SendResult> {
  let body: string;
  try {
    body = traceBody(trace, id);
  } catch {
    // A value JSON can't encode, such as a BigInt: the server could never accept it.
    return { ok: false, id, reason: "invalid_trace" };
  }
  // One signal for the whole request, reading the body included.
  const signal = AbortSignal.timeout(config.timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        authorization: config.authorization,
        "content-type": "application/json",
        accept: "application/json",
      },
      body,
      // A redirect could resend the key elsewhere or turn the POST into a GET, so it's refused.
      redirect: "manual",
      credentials: "omit",
      signal,
    });
    const { status } = response;
    if (response.type === "opaqueredirect" || (status >= 300 && status < 400)) {
      discard(response);
      return { ok: false, id, reason: "network" };
    }
    if (status >= 500 && status < 600) {
      discard(response);
      return { ok: false, id, reason: "server_error", status };
    }
    const answer = parseObject(await response.text());
    return interpret(id, status, answer, response.headers.get("retry-after"));
  } catch {
    return signal.aborted
      ? { ok: false, id, reason: "timeout" }
      : { ok: false, id, reason: "network" };
  }
}

function interpret(
  id: string,
  status: number,
  answer: Record<string, unknown> | null,
  retryAfter: string | null,
): SendResult {
  const unexpected: SendResult = { ok: false, id, reason: "unexpected_response", status };
  if (!answer) return unexpected;
  if (status === 200 || status === 201) {
    const { id: storedId, hasText, textTruncated } = answer;
    if (
      typeof storedId !== "string" ||
      typeof hasText !== "boolean" ||
      typeof textTruncated !== "boolean"
    ) {
      return unexpected;
    }
    return { ok: true, id, status, hasText, textTruncated };
  }
  const { error } = answer;
  if (status === 400 && error === "invalid_trace" && typeof answer.field === "string") {
    return { ok: false, id, reason: "invalid_trace", status, field: answer.field };
  }
  if (status === 401 && error === "invalid_key")
    return { ok: false, id, reason: "invalid_key", status };
  if (status === 409 && error === "trace_conflict")
    return { ok: false, id, reason: "trace_conflict", status };
  if (status === 429 && (error === "key_rate_limited" || error === "rate_limited")) {
    const retryAfterSeconds = seconds(retryAfter) ?? seconds(answer.retryAfterSeconds);
    return retryAfterSeconds === undefined
      ? { ok: false, id, reason: error, status }
      : { ok: false, id, reason: error, status, retryAfterSeconds };
  }
  return unexpected;
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// A whole number of seconds, from a retry-after header or a JSON number.
function seconds(value: unknown): number | undefined {
  const parsed =
    typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : undefined;
}

// Frees the connection without waiting on, or failing over, a body nobody reads.
function discard(response: Response): void {
  response.body?.cancel().catch(() => undefined);
}

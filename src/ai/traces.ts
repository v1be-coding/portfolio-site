import { GetParameterCommand, ParameterNotFound, SSMClient } from "@aws-sdk/client-ssm";
import { createAInakupo } from "./ainakupo.js";

// Reports each AI call to AInakupo, the series' LLM tracing episode, through its
// SDK in ./ainakupo.ts. How a sending episode does this, and what each field
// means, is in ainakupo's docs/using-ainakupo.md.

export const ENDPOINT = "https://ainakupo.emilianocasijr.com";

// The Lambda times out at 10 seconds and a Claude call can take 8, so a trace
// gets at most 1 second. A slow AInakupo then costs the trace, never the answer.
const SEND_TIMEOUT_MS = 1_000;

// What the app knows about one call. No prompt or response: the visitor's text
// never leaves the app, and AInakupo drops text sent with a production key anyway.
export type CallTrace = {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  startedAt: Date;
  durationMs: number;
  costUsd: number | null;
  status: "ok" | "error";
};

export type Reporter = { report(trace: CallTrace): Promise<void> };

const NO_REPORTER: Reporter = { report: () => Promise.resolve() };

// Production traces go on AInakupo's public dashboard. Branch environments use
// the preview key, so their traffic stays off it.
export function keyParameterName(episode: string, target: string): string {
  const key = target === "production" ? "production-key" : "preview-key";
  return `/${episode}/ainakupo/${key}`;
}

export type ReporterDeps = {
  ssm?: Pick<SSMClient, "send">;
  episode?: string;
  target?: string;
};

// Never rejects. With no key in SSM yet, nothing is reported; any other failure
// to read the key is logged as an error, because a refusal isn't "no key".
export async function createReporter(deps: ReporterDeps = {}): Promise<Reporter> {
  const episode = deps.episode ?? process.env.EPISODE ?? "";
  const target = deps.target ?? process.env.TARGET ?? "";
  const ssm = deps.ssm ?? new SSMClient({});
  let ingestKey: string | undefined;
  try {
    const out = await ssm.send(
      new GetParameterCommand({
        Name: keyParameterName(episode, target),
        WithDecryption: true,
      }),
    );
    ingestKey = out.Parameter?.Value;
  } catch (error) {
    if (error instanceof ParameterNotFound) {
      log({ outcome: "not_configured" });
      return NO_REPORTER;
    }
    log({ outcome: "key_unreadable", errorName: errorName(error) }, "error");
    throw error;
  }
  if (!ingestKey) {
    log({ outcome: "not_configured" });
    return NO_REPORTER;
  }

  const client = createAInakupo({ endpoint: ENDPOINT, ingestKey, timeoutMs: SEND_TIMEOUT_MS });
  return {
    async report(trace) {
      const result = await client.send({ provider: "anthropic", ...trace });
      if (!result.ok) {
        log({
          outcome: result.reason,
          ...(result.status === undefined ? {} : { status: result.status }),
          ...(result.field === undefined ? {} : { field: result.field }),
        });
      }
    },
  };
}

let shared: Promise<Reporter> | undefined;

/**
 * One reporter per Lambda container, like claude(). A failed key read isn't
 * kept, so the next request tries again, and the route still gets a reporter
 * that does nothing.
 */
export function reporter(): Promise<Reporter> {
  shared ??= createReporter().catch(() => {
    shared = undefined;
    return NO_REPORTER;
  });
  return shared;
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.constructor.name : undefined;
}

// Metadata only: never a key, and never the trace's text.
function log(
  fields: { outcome: string; errorName?: string; status?: number; field?: string },
  level: "log" | "error" = "log",
): void {
  console[level](JSON.stringify({ component: "ainakupo", ...fields }));
}

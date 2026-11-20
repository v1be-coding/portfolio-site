import { GetParameterCommand, ParameterNotFound } from "@aws-sdk/client-ssm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CallTrace,
  createReporter,
  ENDPOINT,
  keyParameterName,
  type ReporterDeps,
} from "./traces.js";

// A well-formed key made up for these tests. It is never sent anywhere real.
const KEY = `aik_prev_${"A".repeat(43)}`;

const ssmWith = (value: string | undefined) => ({
  send: vi
    .fn()
    .mockResolvedValue({ Parameter: value === undefined ? undefined : { Value: value } }),
});

const ssmFailing = (error: Error) => ({ send: vi.fn().mockRejectedValue(error) });

const notFound = () => new ParameterNotFound({ message: "not found", $metadata: {} });

const trace: CallTrace = {
  feature: "chat",
  model: "claude-haiku-5-5",
  inputTokens: 2000,
  outputTokens: 40,
  startedAt: new Date("2026-11-20T01:00:00Z"),
  durationMs: 900,
  costUsd: 0.00022,
  status: "ok",
};

const created = (status = 201) =>
  new Response(JSON.stringify({ id: "x", hasText: false, textTruncated: false }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("keyParameterName", () => {
  it("uses the production key on production", () => {
    expect(keyParameterName("portfolio-site", "production")).toBe(
      "/portfolio-site/ainakupo/production-key",
    );
  });

  it("uses the preview key everywhere else, so branch traffic stays off the dashboard", () => {
    expect(keyParameterName("portfolio-site", "branch-12")).toBe(
      "/portfolio-site/ainakupo/preview-key",
    );
  });
});

describe("createReporter", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const log = () => vi.mocked(console.log);
  const error = () => vi.mocked(console.error);

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(created());
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const deps = (ssm: object): ReporterDeps => ({
    ssm: ssm as ReporterDeps["ssm"],
    episode: "portfolio-site",
    target: "branch-12",
  });

  it("reads the target's key with decryption", async () => {
    const ssm = ssmWith(KEY);

    await createReporter(deps(ssm));

    const command = ssm.send.mock.calls[0]?.[0] as GetParameterCommand;
    expect(command).toBeInstanceOf(GetParameterCommand);
    expect(command.input).toEqual({
      Name: "/portfolio-site/ainakupo/preview-key",
      WithDecryption: true,
    });
  });

  it("sends a trace to AInakupo's ingest route with the key, as Anthropic, without text", async () => {
    const reporter = await createReporter(deps(ssmWith(KEY)));

    await reporter.report(trace);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith(ENDPOINT)).toBe(true);
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({
      provider: "anthropic",
      feature: "chat",
      model: "claude-haiku-5-5",
      inputTokens: 2000,
      outputTokens: 40,
      durationMs: 900,
      costUsd: 0.00022,
      status: "ok",
    });
    expect(sent).not.toHaveProperty("prompt");
    expect(sent).not.toHaveProperty("response");
  });

  it("reports nothing when the episode has no key yet", async () => {
    const reporter = await createReporter(deps(ssmFailing(notFound())));

    await reporter.report(trace);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(error()).not.toHaveBeenCalled();
  });

  it("rejects and logs an error when SSM refuses, rather than reading it as no key", async () => {
    const refused = Object.assign(new Error("denied"), { name: "AccessDeniedException" });

    await expect(createReporter(deps(ssmFailing(refused)))).rejects.toBe(refused);

    expect(error()).toHaveBeenCalledTimes(1);
    expect(String(error().mock.calls[0]?.[0])).toContain("key_unreadable");
  });

  it("logs a refused trace's reason and never throws", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_key" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    const reporter = await createReporter(deps(ssmWith(KEY)));

    await expect(reporter.report(trace)).resolves.toBeUndefined();

    const line = log()
      .mock.calls.map((call) => String(call[0]))
      .join("\n");
    expect(line).toContain("invalid_key");
    expect(line).not.toContain(KEY);
  });

  it("never throws when AInakupo can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const reporter = await createReporter(deps(ssmWith(KEY)));

    await expect(reporter.report(trace)).resolves.toBeUndefined();
  });
});

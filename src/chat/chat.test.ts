import Anthropic from "@anthropic-ai/sdk";
import { ConditionalCheckFailedException, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { content } from "../content/content.js";
import type { Store } from "../limits/store.js";
import { chatRoute, type ChatDeps, type ModelClient } from "./chat.js";
import { systemPrompt } from "./prompt.js";

vi.mock("../limits/metrics.js", () => ({ recordMetric: vi.fn() }));

// 12:00:15 UTC: 45 s left in the minute, 2,985 s left in the hour.
const NOW = Date.UTC(2026, 10, 17, 12, 0, 15);

const user = (content: string) => ({ role: "user", content });
const assistant = (content: string) => ({ role: "assistant", content });
const body = (value: unknown) => JSON.stringify(value);
const valid = body({ messages: [user("Where has Emiliano worked?")] });

const modelReply = (text: string, stop_reason = "end_turn") => ({
  content: text ? [{ type: "text", text }] : [],
  stop_reason,
  usage: { input_tokens: 2000, output_tokens: 40 },
});

// A store whose chat counter is at `chatCount` after this request, and whose
// spend counter always has room.
function fakeStore(chatCount = 1) {
  const send = vi.fn((command: UpdateItemCommand) => {
    const pk = command.input.Key?.pk?.S ?? "";
    return Promise.resolve(
      pk.startsWith("chat#") ? { Attributes: { count: { N: String(chatCount) } } } : {},
    );
  });
  return { db: { send } as unknown as Store, send };
}

function setup(options: { chatCount?: number; target?: string } = {}) {
  const create = vi.fn().mockResolvedValue(modelReply("Emiliano works at Prostrive."));
  const client: ModelClient = { messages: { create } };
  const { db, send } = fakeStore(options.chatCount);
  const deps: ChatDeps = {
    client: () => Promise.resolve(client),
    db,
    table: "limits",
    target: options.target ?? "branch-1",
    capUsd: 1,
    now: () => NOW,
  };
  const post = (requestBody: string | undefined) =>
    chatRoute({ method: "POST", body: requestBody, callerHash: "abc" }, deps);
  return { create, send, deps, post };
}

const parsed = (response: unknown) => JSON.parse((response as { body: string }).body) as unknown;

describe("chatRoute", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("answers a valid conversation with the model's reply", async () => {
    const { post } = setup();

    const response = await post(valid);

    expect(response).toMatchObject({
      statusCode: 200,
      headers: { "content-type": "application/json" },
    });
    expect(parsed(response)).toEqual({ reply: "Emiliano works at Prostrive." });
  });

  it("calls the model with the fixed model, max_tokens, no thinking and the system prompt", async () => {
    const { post, create } = setup();

    await post(valid);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-5-5",
        max_tokens: 500,
        thinking: { type: "disabled" },
        system: expect.stringContaining("Emiliano") as unknown,
        messages: [{ role: "user", content: "Where has Emiliano worked?" }],
      }),
    );
  });
});

const alternating = (count: number) =>
  Array.from({ length: count }, (_, i) => (i % 2 === 0 ? user(`q${i}`) : assistant(`a${i}`)));

describe("chatRoute validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it.each([
    ["a non-JSON body", "not json"],
    ["an empty body", ""],
    ["no body", undefined],
    ["a JSON array", body([user("hi")])],
    ["a JSON string", body("hi")],
    ["a JSON number", "42"],
    ["JSON null", "null"],
    ["a missing messages key", body({})],
    ["an extra top-level key", body({ messages: [user("hi")], extra: true })],
    ["messages that isn't an array", body({ messages: user("hi") })],
    ["an empty messages array", body({ messages: [] })],
    ["a 30-item array", body({ messages: alternating(30) })],
    ["a 31-item array", body({ messages: alternating(31) })],
    ["a message that isn't an object", body({ messages: ["hi"] })],
    ["a null message", body({ messages: [null] })],
    ["a message missing content", body({ messages: [{ role: "user" }] })],
    ["a message missing role", body({ messages: [{ content: "hi" }] })],
    ["extra keys on a message", body({ messages: [{ ...user("hi"), name: "x" }] })],
    ["a system role", body({ messages: [{ role: "system", content: "hi" }] })],
    ["an unknown role", body({ messages: [{ role: "bot", content: "hi" }] })],
    ["two user messages in a row", body({ messages: [user("a"), user("b")] })],
    [
      "two assistant messages in a row",
      body({ messages: [user("a"), assistant("b"), assistant("c"), user("d")] }),
    ],
    ["a first role of assistant", body({ messages: [assistant("hello"), user("hi")] })],
    ["a last role of assistant", body({ messages: [user("hi"), assistant("hello")] })],
    ["non-string content", body({ messages: [{ role: "user", content: 5 }] })],
    [
      "content as an array of blocks",
      body({ messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }),
    ],
    ["empty user content", body({ messages: [user("")] })],
    ["user content of 501 characters", body({ messages: [user("a".repeat(501))] })],
    ["empty assistant content", body({ messages: [user("a"), assistant(""), user("b")] })],
    [
      "assistant content of 4001 characters",
      body({ messages: [user("a"), assistant("a".repeat(4001)), user("b")] }),
    ],
  ])("refuses %s with invalid_request, without calling the model", async (_name, requestBody) => {
    const { post, create } = setup();

    const response = await post(requestBody);

    expect(response).toMatchObject({ statusCode: 400 });
    expect(parsed(response)).toEqual({ error: "invalid_request", message: "Invalid conversation" });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ["29 alternating messages", alternating(29)],
    ["user content of 500 characters", [user("a".repeat(500))]],
    ["assistant content of 4000 characters", [user("a"), assistant("b".repeat(4000)), user("c")]],
  ])("accepts %s", async (_name, messages) => {
    const { post, create } = setup();

    const response = await post(body({ messages }));

    expect(response).toMatchObject({ statusCode: 200 });
    expect(create).toHaveBeenCalledOnce();
  });

  it("forwards the conversation as role and content only", async () => {
    const { post, create } = setup();

    await post(body({ messages: [user("a"), { content: "b", role: "assistant" }, user("c")] }));

    const forwarded = (create.mock.calls[0]?.[0] as { messages: unknown[] }).messages;
    expect(forwarded).toEqual([user("a"), assistant("b"), user("c")]);
  });
});

const chatKeys = (send: ReturnType<typeof vi.fn>) =>
  send.mock.calls
    .map(([command]) => (command as UpdateItemCommand).input.Key?.pk?.S ?? "")
    .filter((pk) => pk.startsWith("chat#"));

describe("chatRoute rate limit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("lets the 20th request in a window through", async () => {
    const { post } = setup({ chatCount: 20 });

    expect(await post(valid)).toMatchObject({ statusCode: 200 });
  });

  it("refuses the 21st with chat_rate_limited and the seconds left in the minute", async () => {
    const { post, create } = setup({ chatCount: 21 });

    const response = await post(valid);

    expect(response).toEqual({
      statusCode: 429,
      headers: { "content-type": "application/json", "retry-after": "45" },
      body: JSON.stringify({
        error: "chat_rate_limited",
        message: "Too many questions. Try again in 45 seconds.",
        retryAfterSeconds: 45,
      }),
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("uses a 60-second window starting on the minute off production", async () => {
    const { post, send } = setup({ target: "branch-7", chatCount: 21 });

    const response = await post(valid);

    expect(chatKeys(send)).toEqual([`chat#abc#${Date.UTC(2026, 10, 17, 12, 0, 0) / 1000}`]);
    expect(parsed(response)).toMatchObject({ retryAfterSeconds: 60 - 15 });
  });

  it("uses a one-hour window starting on the hour on production", async () => {
    const { post, send } = setup({ target: "production", chatCount: 21 });

    const response = await post(valid);

    expect(chatKeys(send)).toEqual([`chat#abc#${Date.UTC(2026, 10, 17, 12, 0, 0) / 1000}`]);
    expect(parsed(response)).toMatchObject({ retryAfterSeconds: 3600 - 15 });
  });

  it("counts an invalid request", async () => {
    const { post, send } = setup();

    expect(await post("not json")).toMatchObject({ statusCode: 400 });
    expect(chatKeys(send)).toHaveLength(1);
  });

  it("checks the limit before validation", async () => {
    const { post } = setup({ chatCount: 21 });

    expect(parsed(await post("not json"))).toMatchObject({ error: "chat_rate_limited" });
  });

  it("refuses with the server_error 500 if the counter fails, and logs only the outcome", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { post, send, create } = setup();
    send.mockRejectedValueOnce(new Error("SECRET-throttled"));

    const response = await post(valid);

    expect(response).toMatchObject({ statusCode: 500 });
    expect(parsed(response)).toEqual({ error: "server_error", message: "Something went wrong" });
    expect(create).not.toHaveBeenCalled();
    const calls = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.log).mock.calls];
    expect(calls.flat().every((arg) => typeof arg === "string")).toBe(true);
    const logged = calls.flat().join("\n");
    expect(logged).not.toContain("SECRET");
    expect(JSON.parse(logged)).toMatchObject({ outcome: "rate_limit_error", errorName: "Error" });
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"])(
    "answers %s with 405 without counting it",
    async (method) => {
      const { deps, send, create } = setup();

      const response = await chatRoute({ method, body: valid, callerHash: "abc" }, deps);

      expect(response).toMatchObject({ statusCode: 405 });
      expect(parsed(response)).toEqual({ error: "Method not allowed" });
      expect(send).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );
});

const apiError = (status: number, type: string, message: string, details?: object) =>
  Anthropic.APIError.generate(
    status,
    { type: "error", error: { type, message, ...(details ? { details } : {}) } },
    undefined,
    new Headers(),
  );

// 12:00:15 UTC is 11 h 59 min 45 s before midnight.
const DAILY_CAP = {
  statusCode: 429,
  headers: { "content-type": "application/json", "retry-after": "43185" },
  body: JSON.stringify({
    error: "daily_cap",
    message: "The AI feature is paused until tomorrow",
    retryAfterSeconds: 43185,
  }),
};
const AI_BUSY = { error: "ai_busy", message: "The AI is busy. Try again in a minute." };
const SERVER_ERROR = { error: "server_error", message: "Something went wrong" };

describe("chatRoute spend cap and model errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("answers with the daily_cap 429 once the day's cap is reached, without calling the model", async () => {
    const { post, send, create } = setup();
    send.mockImplementation((command: UpdateItemCommand) =>
      (command.input.Key?.pk?.S ?? "").startsWith("spend#")
        ? Promise.reject(new ConditionalCheckFailedException({ message: "full", $metadata: {} }))
        : Promise.resolve({ Attributes: { count: { N: "1" } } }),
    );

    expect(await post(valid)).toEqual(DAILY_CAP);
    expect(create).not.toHaveBeenCalled();
  });

  it("validates before touching the spend cap", async () => {
    const { post, send } = setup();

    await post("not json");

    const keys = send.mock.calls.map(([command]) => command.input.Key?.pk?.S ?? "");
    expect(keys.some((pk) => pk.startsWith("spend#"))).toBe(false);
  });

  it("counts the system prompt in the worst case it reserves", async () => {
    const { post, send } = setup();

    await post(valid);

    const reserve = send.mock.calls
      .map(([command]) => command.input)
      .find((input) => (input.Key?.pk?.S ?? "").startsWith("spend#"));
    const micros = Number(reserve?.ExpressionAttributeValues?.[":micros"]?.N);
    // 500 output tokens at $0.50 per million come to 250 micro-dollars, so
    // anything over 500 means the system prompt's input tokens were counted.
    expect(micros).toBeGreaterThan(500);
  });

  it.each([
    [
      "Anthropic's spend limit",
      () => apiError(400, "invalid_request_error", "You have reached your API usage limits."),
    ],
    [
      "the tier's spend cap",
      () =>
        apiError(429, "rate_limit_error", "Spend limit reached", {
          error_code: "enforced_spend_limit_reached",
        }),
    ],
  ])("answers %s with the same daily_cap 429", async (_name, error) => {
    const { post, create } = setup();
    create.mockRejectedValue(error());

    expect(await post(valid)).toEqual(DAILY_CAP);
  });

  it.each([
    ["a rate limit", () => apiError(429, "rate_limit_error", "Slow down")],
    ["overload", () => apiError(529, "overloaded_error", "Overloaded")],
    ["a timeout", () => new Anthropic.APIConnectionTimeoutError()],
  ])("answers %s with the ai_busy 503", async (_name, error) => {
    const { post, create } = setup();
    create.mockRejectedValue(error());

    const response = await post(valid);

    expect(response).toMatchObject({ statusCode: 503 });
    expect(parsed(response)).toEqual(AI_BUSY);
  });

  it.each([
    ["an auth failure", () => apiError(401, "authentication_error", "Bad token")],
    ["any other error", () => new Error("boom")],
  ])("answers %s with the server_error 500 and logs it", async (_name, error) => {
    const { post, create } = setup();
    create.mockRejectedValue(error());

    const response = await post(valid);

    expect(response).toMatchObject({ statusCode: 500 });
    expect(parsed(response)).toEqual(SERVER_ERROR);
    expect(console.error).toHaveBeenCalled();
  });

  it.each([
    [
      "an auth failure",
      () => apiError(401, "authentication_error", "SECRET-token"),
      { outcome: "auth", errorName: "AuthenticationError", status: 401 },
    ],
    [
      "any other error",
      () => new TypeError("SECRET-boom"),
      { outcome: "other", errorName: "TypeError" },
    ],
  ])("logs %s as metadata only, never the error or its text", async (_name, error, expected) => {
    const { post, create } = setup();
    create.mockRejectedValue(error());

    await post(valid);

    const calls = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.log).mock.calls];
    expect(calls.flat().every((arg) => typeof arg === "string")).toBe(true);
    const logged = calls.flat().join("\n");
    expect(logged).not.toContain("SECRET");
    expect(JSON.parse(logged)).toMatchObject(expected);
  });

  it("answers with the server_error 500 when the client can't be set up", async () => {
    const { post, deps } = setup();
    deps.client = () => Promise.reject(new Error("The Anthropic federation parameter is empty"));

    const response = await post(valid);

    expect(response).toMatchObject({ statusCode: 500 });
    expect(parsed(response)).toEqual(SERVER_ERROR);
  });
});

describe("chatRoute replies", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns a refused reply as it is", async () => {
    const { post, create } = setup();
    create.mockResolvedValue(modelReply("I can't help with that.", "refusal"));

    expect(parsed(await post(valid))).toEqual({ reply: "I can't help with that." });
  });

  it("returns a cut-off reply as it is", async () => {
    const { post, create } = setup();
    create.mockResolvedValue(modelReply("Emiliano worked at", "max_tokens"));

    expect(parsed(await post(valid))).toEqual({ reply: "Emiliano worked at" });
  });

  it("answers with the decline line when the model returns no text", async () => {
    const { post, create } = setup();
    create.mockResolvedValue(modelReply("", "refusal"));

    expect(parsed(await post(valid))).toEqual({
      reply:
        "I can only answer questions about Emiliano's experience and the V1be Coding series. You can email casi.emilianojr@gmail.com.",
    });
  });

  it("keeps a reply within 4,000 characters, so the client can send it back", async () => {
    const { post, create } = setup();
    create.mockResolvedValue(modelReply("x".repeat(4500)));

    const { reply } = parsed(await post(valid)) as { reply: string };

    expect(reply).toHaveLength(4000);
  });

  it("logs metadata only, never the question or the reply", async () => {
    const { post, create } = setup();
    create.mockResolvedValue(modelReply("SECRET-REPLY"));

    await post(body({ messages: [user("SECRET-QUESTION")] }));

    const logged = vi.mocked(console.log).mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain("SECRET");
    const line = JSON.parse(logged) as Record<string, unknown>;
    expect(line).toMatchObject({
      outcome: "ok",
      inputTokens: 2000,
      outputTokens: 40,
      stopReason: "end_turn",
    });
    expect(line.durationMs).toEqual(expect.any(Number));
  });
});

describe("chatRoute system prompt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  const systemSent = async () => {
    const { post, create } = setup();
    await post(valid);
    return (create.mock.calls[0]?.[0] as { system: string }).system;
  };

  it("holds the decline line exactly", async () => {
    expect(await systemSent()).toContain(
      "I can only answer questions about Emiliano's experience and the V1be Coding series. You can email casi.emilianojr@gmail.com.",
    );
  });

  it.each([
    "Senior full-stack engineer building fintech and AI-first products.",
    "Senior Software Engineer / Lead Developer, Prostrive (Remote)",
    "Software Engineer (Full Stack), WebMD (Remote)",
    "White-label online banking platform",
    "Video-based hiring platform, Team Lead",
    "Merged 158 PRs (~9% of the team total)",
    "Mar 2021 – Mar 2023",
    "ZITADEL, KYC onboarding",
    "BS Mechanical Engineering, Saint Louis University, 2020",
    "V1be Coding is a build series about one skill",
    "Episode 0: Portfolio site",
  ])("holds the site content: %s", async (text) => {
    expect(await systemSent()).toContain(text);
  });

  it("is built from the content module", () => {
    const changed = {
      ...content,
      profile: { ...content.profile, bio: "A bio that only this test uses." },
    };

    expect(systemPrompt(changed)).toContain("A bio that only this test uses.");
  });

  it("never holds a phone number", async () => {
    expect(await systemSent()).not.toMatch(/\+63|3959/);
  });
});

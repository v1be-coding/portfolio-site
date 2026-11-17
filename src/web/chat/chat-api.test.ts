import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, RateLimitedError } from "../api.js";
import { askChat, checkHealth } from "./chat-api.js";

const respond = (status: number, body: string, headers: Record<string, string> = {}) => {
  const fetch = vi.fn().mockResolvedValue(new Response(body, { status, headers }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askChat", () => {
  it("posts the conversation and returns the reply", async () => {
    const fetch = respond(200, '{"reply":"He works on web apps."}');
    const messages = [{ role: "user" as const, content: "What does Emiliano work on?" }];

    expect(await askChat(messages)).toBe("He works on web apps.");
    const [path, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ messages });
  });

  it("throws the API's typed errors", async () => {
    respond(429, '{"error":"rate_limited"}', { "retry-after": "37" });
    await expect(askChat([{ role: "user", content: "Hi" }])).rejects.toBeInstanceOf(
      RateLimitedError,
    );

    respond(503, '{"error":"ai_busy"}');
    await expect(askChat([{ role: "user", content: "Hi" }])).rejects.toMatchObject({ status: 503 });
  });

  it("treats a reply that isn't text as a failed send", async () => {
    respond(200, '{"reply":""}');

    await expect(askChat([{ role: "user", content: "Hi" }])).rejects.toBeInstanceOf(ApiError);
  });
});

describe("checkHealth", () => {
  it("resolves when the API answers ok", async () => {
    respond(200, '{"status":"ok"}');

    await expect(checkHealth()).resolves.toBeUndefined();
  });

  it("rejects on any other answer", async () => {
    respond(500, '{"error":"Internal error"}');

    await expect(checkHealth()).rejects.toBeInstanceOf(ApiError);
  });
});

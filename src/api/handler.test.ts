import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { countNotes, getNote, putNote } from "../db/notes.js";
import { chatRoute } from "../chat/chat.js";
import { callerHash, guardRequest } from "../limits/guard.js";
import { handler } from "./handler.js";

vi.mock("../db/notes.js", () => ({ countNotes: vi.fn(), getNote: vi.fn(), putNote: vi.fn() }));
vi.mock("../limits/guard.js", () => ({ guardRequest: vi.fn(), callerHash: vi.fn() }));
vi.mock("../chat/chat.js", () => ({ chatRoute: vi.fn() }));

const id = "6f1c2f6e-3f0a-4a53-9d7e-0a4f9c1b2d3e";

const request = (method: string, rawPath: string, body?: string) =>
  ({ rawPath, body, requestContext: { http: { method } } }) as unknown as APIGatewayProxyEventV2;

describe("handler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reports healthy on /api/health", async () => {
    const response = await handler(request("GET", "/api/health"));

    expect(response).toMatchObject({ statusCode: 200, body: '{"status":"ok"}' });
  });

  it("sends the guard's response instead of running a route", async () => {
    vi.mocked(guardRequest).mockResolvedValue({ statusCode: 429, body: "{}" });

    const response = await handler(request("PUT", `/api/notes/${id}`, '{"text":"hi"}'));

    expect(response).toMatchObject({ statusCode: 429 });
    expect(putNote).not.toHaveBeenCalled();
  });

  it.each([
    ["a route's answer", () => request("GET", "/api/health")],
    ["a 404", () => request("GET", "/nope")],
    ["a 405", () => request("POST", "/api/notes/count")],
  ])("sends no-store and nosniff on %s", async (_name, make) => {
    const response = await handler(make());

    expect(response).toMatchObject({
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  });

  it("sends no-store and nosniff on the guard's refusal, keeping its own headers", async () => {
    vi.mocked(guardRequest).mockResolvedValue({
      statusCode: 429,
      headers: { "retry-after": "30" },
      body: "{}",
    });

    const response = await handler(request("GET", "/api/health"));

    expect(response).toMatchObject({
      statusCode: 429,
      headers: {
        "retry-after": "30",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });

  it("sends no-store and nosniff on a guard refusal that has no headers", async () => {
    vi.mocked(guardRequest).mockResolvedValue({ statusCode: 403, body: "" });

    const response = await handler(request("GET", "/api/health"));

    expect(response).toMatchObject({
      statusCode: 403,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  });

  it("sends POST /api/chat to the chat route with the caller's hash", async () => {
    vi.mocked(chatRoute).mockResolvedValue({ statusCode: 200, body: '{"reply":"hi"}' });
    vi.mocked(callerHash).mockReturnValue("hash");

    const response = await handler(request("POST", "/api/chat", '{"messages":[]}'));

    expect(chatRoute).toHaveBeenCalledWith({
      method: "POST",
      body: '{"messages":[]}',
      callerHash: "hash",
    });
    expect(response).toMatchObject({
      statusCode: 200,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  });

  it("decodes a base64 body before the chat route reads it", async () => {
    vi.mocked(chatRoute).mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = {
      ...request("POST", "/api/chat", Buffer.from('{"messages":[]}').toString("base64")),
      isBase64Encoded: true,
    } as APIGatewayProxyEventV2;

    await handler(event);

    expect(chatRoute).toHaveBeenCalledWith(expect.objectContaining({ body: '{"messages":[]}' }));
  });

  it("checks the global per-IP limit before the chat route", async () => {
    vi.mocked(guardRequest).mockResolvedValue({ statusCode: 429, body: "{}" });

    const response = await handler(request("POST", "/api/chat", "{}"));

    expect(response).toMatchObject({ statusCode: 429 });
    expect(chatRoute).not.toHaveBeenCalled();
  });

  it("returns 404 for anything else", async () => {
    const response = await handler(request("GET", "/nope"));

    expect(response).toMatchObject({ statusCode: 404 });
  });

  it("saves a note under the client's ID", async () => {
    const response = await handler(
      request("PUT", `/api/notes/${id}`, JSON.stringify({ text: "hello" })),
    );

    expect(putNote).toHaveBeenCalledWith(id, "hello");
    expect(response).toMatchObject({ statusCode: 200 });
    expect(JSON.parse((response as { body: string }).body)).toEqual({ id, text: "hello" });
  });

  it("returns a saved note", async () => {
    vi.mocked(getNote).mockResolvedValue({ id, text: "hello" });

    const response = await handler(request("GET", `/api/notes/${id}`));

    expect(response).toMatchObject({ statusCode: 200 });
    expect(JSON.parse((response as { body: string }).body)).toEqual({ id, text: "hello" });
  });

  it("returns 404 for a note that doesn't exist", async () => {
    vi.mocked(getNote).mockResolvedValue(undefined);

    const response = await handler(request("GET", `/api/notes/${id}`));

    expect(response).toMatchObject({ statusCode: 404 });
  });

  it.each([
    ["no body", undefined],
    ["invalid JSON", "{"],
    ["text that isn't a string", '{"text":1}'],
    ["empty text", '{"text":""}'],
    ["text over 1,000 characters", JSON.stringify({ text: "x".repeat(1001) })],
  ])("refuses %s", async (_name, body) => {
    const response = await handler(request("PUT", `/api/notes/${id}`, body));

    expect(response).toMatchObject({ statusCode: 400 });
    expect(putNote).not.toHaveBeenCalled();
  });

  it("returns 404 for an ID that isn't a UUID", async () => {
    const response = await handler(request("GET", "/api/notes/not-a-uuid"));

    expect(response).toMatchObject({ statusCode: 404 });
    expect(getNote).not.toHaveBeenCalled();
  });

  it("returns 405 for a method the notes route doesn't take", async () => {
    const response = await handler(request("DELETE", `/api/notes/${id}`));

    expect(response).toMatchObject({ statusCode: 405 });
  });

  it("returns how many notes are saved", async () => {
    vi.mocked(countNotes).mockResolvedValue(3);

    const response = await handler(request("GET", "/api/notes/count"));

    expect(response).toMatchObject({ statusCode: 200 });
    expect(JSON.parse((response as { body: string }).body)).toEqual({ count: 3 });
  });

  it("returns a 5xx when the count can't be read", async () => {
    vi.mocked(countNotes).mockRejectedValue(new Error("connection refused"));

    const response = (await handler(request("GET", "/api/notes/count"))) as { statusCode: number };

    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    expect(response.statusCode).toBeLessThan(600);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("returns 405 for %s on the count", async (method) => {
    const response = await handler(request(method, "/api/notes/count", '{"text":"hi"}'));

    expect(response).toMatchObject({ statusCode: 405 });
    expect(JSON.parse((response as { body: string }).body)).toEqual({
      error: "Method not allowed",
    });
    expect(countNotes).not.toHaveBeenCalled();
    expect(putNote).not.toHaveBeenCalled();
  });
});

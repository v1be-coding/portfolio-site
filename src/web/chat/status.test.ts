import { describe, expect, it } from "vitest";
import { ApiError, RateLimitedError } from "../api.js";
import { chatStatus, type StatusInput } from "./status.js";

const afterSend = (sendError: unknown): StatusInput => ({
  health: "ok",
  pending: false,
  sendError,
});

describe("chatStatus", () => {
  it("is empty while nothing is happening", () => {
    expect(chatStatus({ health: "checking", pending: false, sendError: null })).toEqual({
      text: "",
      offerEmail: false,
    });
    expect(chatStatus({ health: "ok", pending: false, sendError: null }).text).toBe("");
  });

  it("says the Chat is thinking while a reply is pending", () => {
    expect(chatStatus({ health: "ok", pending: true, sendError: null }).text).toBe("Thinking…");
  });

  it.each([
    ["an error status", new ApiError(500, "Internal error")],
    ["no response", new TypeError("Failed to fetch")],
  ])("says the Chat is unavailable when the health check gets %s", (_name, error) => {
    expect(chatStatus({ health: { error }, pending: false, sendError: null }).text).toBe(
      "The Chat is unavailable right now.",
    );
  });

  it("shows the per-IP limit when the health check is rate limited", () => {
    const health = { error: new RateLimitedError(30, "rate_limited") };

    expect(chatStatus({ health, pending: false, sendError: null }).text).toBe(
      "Too many requests. Try again in 30 seconds.",
    );
  });

  it("shows the per-IP limit when a send is rate limited", () => {
    expect(chatStatus(afterSend(new RateLimitedError(37, "rate_limited"))).text).toBe(
      "Too many requests. Try again in 37 seconds.",
    );
  });

  it("shows the questions limit when the chat limit is hit", () => {
    expect(chatStatus(afterSend(new RateLimitedError(42, "chat_rate_limited"))).text).toBe(
      "Too many questions. Try again in 42 seconds.",
    );
  });

  it("offers email once the AI feature has paused for the day", () => {
    expect(chatStatus(afterSend(new RateLimitedError(3600, "daily_cap")))).toEqual({
      text: "The AI feature is paused until tomorrow.",
      offerEmail: true,
    });
  });

  it("says the Chat is busy when the model is", () => {
    expect(chatStatus(afterSend(new ApiError(503, "ai_busy")))).toEqual({
      text: "The Chat is busy right now. Try again in a minute.",
      offerEmail: false,
    });
  });

  it.each([
    ["a server error", new ApiError(500, "server_error")],
    ["a 503 that isn't the app's", new ApiError(503)],
    ["no response", new TypeError("Failed to fetch")],
  ])("says a message didn't send after %s", (_name, error) => {
    expect(chatStatus(afterSend(error)).text).toBe("Your message didn't send. Try again.");
  });
});

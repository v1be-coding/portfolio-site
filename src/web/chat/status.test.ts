import { describe, expect, it } from "vitest";
import { ApiError, RateLimitedError } from "../api.js";
import { statusText } from "./status.js";

describe("statusText", () => {
  it("is empty while nothing is happening", () => {
    expect(statusText({ health: "checking", pending: false, sendError: null })).toBe("");
    expect(statusText({ health: "ok", pending: false, sendError: null })).toBe("");
  });

  it("says the Chat is thinking while a reply is pending", () => {
    expect(statusText({ health: "ok", pending: true, sendError: null })).toBe("Thinking…");
  });

  it("says the Chat is unavailable when the health check fails", () => {
    expect(
      statusText({ health: { error: new ApiError(500) }, pending: false, sendError: null }),
    ).toBe("The Chat is unavailable right now.");
  });

  it("shows the per-IP limit when the health check is rate limited", () => {
    const health = { error: new RateLimitedError(30, "rate_limited") };

    expect(statusText({ health, pending: false, sendError: null })).toBe(
      "Too many requests. Try again in 30 seconds.",
    );
  });

  it("says a failed message didn't send", () => {
    expect(
      statusText({ health: "ok", pending: false, sendError: new TypeError("Failed to fetch") }),
    ).toBe("Your message didn't send. Try again.");
  });
});

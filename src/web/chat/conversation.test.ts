import { describe, expect, it } from "vitest";
import { ApiError } from "../api.js";
import {
  conversationReducer,
  INITIAL_CONVERSATION,
  isFull,
  type Conversation,
} from "./conversation.js";

const send = (state: Conversation, text: string) =>
  conversationReducer(state, { type: "sent", text });
const reply = (state: Conversation, text: string) =>
  conversationReducer(state, { type: "replied", text });

function exchanges(count: number): Conversation {
  let state = INITIAL_CONVERSATION;
  for (let i = 0; i < count; i++) state = reply(send(state, `question ${i}`), `answer ${i}`);
  return state;
}

describe("conversation", () => {
  it("starts with no messages, so the greeting is never sent", () => {
    expect(INITIAL_CONVERSATION.messages).toEqual([]);
    expect(INITIAL_CONVERSATION.pending).toBe(false);
  });

  it("adds the visitor's message and waits for the reply", () => {
    const state = send(INITIAL_CONVERSATION, "Where has Emiliano worked?");

    expect(state.messages).toEqual([{ role: "user", content: "Where has Emiliano worked?" }]);
    expect(state.pending).toBe(true);
  });

  it("adds the reply and stops waiting", () => {
    const state = reply(send(INITIAL_CONVERSATION, "Hi"), "Hello there");

    expect(state.messages).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello there" },
    ]);
    expect(state.pending).toBe(false);
  });

  it("drops the visitor's message and keeps the error when sending fails", () => {
    const before = exchanges(1);
    const error = new ApiError(500);

    const state = conversationReducer(send(before, "Lost question"), { type: "failed", error });

    expect(state.messages).toEqual(before.messages);
    expect(state.pending).toBe(false);
    expect(state.sendError).toBe(error);
  });

  it("clears the last error on the next send", () => {
    const failed = conversationReducer(send(INITIAL_CONVERSATION, "Q"), {
      type: "failed",
      error: new ApiError(500),
    });

    expect(send(failed, "Q").sendError).toBeNull();
  });

  it("is full at 30 messages, not before", () => {
    expect(isFull(send(exchanges(14), "q").messages)).toBe(false);
    expect(isFull(exchanges(15).messages)).toBe(true);
  });

  it("starts over with no messages", () => {
    expect(conversationReducer(exchanges(15), { type: "startedOver" })).toEqual(
      INITIAL_CONVERSATION,
    );
  });
});

// The Chat's conversation as plain state, kept apart from the panel so its rules
// can be tested without a browser. The greeting is display only: it never enters
// `messages`, so it is never sent and never counts toward the limit.

export type Message = { role: "user" | "assistant"; content: string };

export type Conversation = {
  messages: Message[];
  pending: boolean;
  // Why the last send failed: an error from ../api.ts or a network TypeError.
  sendError: unknown;
  // Kept apart from `messages` because a failed send empties the log again, and
  // the suggestions must stay hidden after any send until the visitor starts over.
  showSuggestions: boolean;
};

export type ConversationAction =
  | { type: "sent"; text: string }
  | { type: "replied"; text: string }
  | { type: "failed"; error: unknown }
  | { type: "startedOver" };

// The API refuses a 30-message conversation, so at 30 the visitor must start over.
export const MAX_MESSAGES = 30;

export const INITIAL_CONVERSATION: Conversation = {
  messages: [],
  pending: false,
  sendError: null,
  showSuggestions: true,
};

export function isFull(messages: readonly Message[]): boolean {
  return messages.length >= MAX_MESSAGES;
}

export function conversationReducer(state: Conversation, action: ConversationAction): Conversation {
  switch (action.type) {
    case "sent":
      return {
        messages: [...state.messages, { role: "user", content: action.text }],
        pending: true,
        sendError: null,
        showSuggestions: false,
      };
    case "replied":
      return {
        messages: [...state.messages, { role: "assistant", content: action.text }],
        pending: false,
        sendError: null,
        showSuggestions: false,
      };
    case "failed":
      // The unanswered question goes back to the textbox, so it leaves the log.
      return {
        messages: state.messages.slice(0, -1),
        pending: false,
        sendError: action.error,
        showSuggestions: false,
      };
    case "startedOver":
      return INITIAL_CONVERSATION;
  }
}

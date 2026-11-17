// The rules for a POST /api/chat body (spec #2, Routes). Every failure gets the
// same 400, so the order of the checks here doesn't matter to a caller.

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 29;
// The same bound as a reply, so any reply the server gave can be sent back.
export const MAX_ASSISTANT_LENGTH = 4000;
const MAX_LENGTH = { user: 500, assistant: MAX_ASSISTANT_LENGTH } as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};

// Returns the conversation rebuilt from role and content only, or undefined if
// the body breaks any rule. Nothing from the client is forwarded as it is.
export function parseConversation(body: string | undefined): ChatMessage[] | undefined {
  let value: unknown;
  try {
    value = JSON.parse(body ?? "");
  } catch {
    return undefined;
  }
  if (!isObject(value) || !hasExactKeys(value, ["messages"])) return undefined;

  const { messages } = value;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    return undefined;
  }

  const rebuilt: ChatMessage[] = [];
  for (const [index, item] of messages.entries()) {
    if (!isObject(item) || !hasExactKeys(item, ["role", "content"])) return undefined;
    // Alternating from a user first, with an odd count, also makes the last a user.
    const role = index % 2 === 0 ? "user" : "assistant";
    const { content } = item;
    if (item.role !== role) return undefined;
    if (typeof content !== "string" || content.length < 1 || content.length > MAX_LENGTH[role]) {
      return undefined;
    }
    rebuilt.push({ role, content });
  }
  if (rebuilt.length % 2 === 0) return undefined;
  return rebuilt;
}

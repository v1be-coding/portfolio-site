import { expect, test } from "../helpers/fixtures.js";
import { waitForFreshChatWindow } from "../helpers/browser.js";

// Spec #2, C4. Its own project, chat-rate-limit, after acceptance and never on
// production, because it uses up this IP's chat window on purpose.
test.use({ allow429: true, apiBudget: 25 });

const INVALID = { error: "invalid_request", message: "Invalid conversation" };

test("C4: the 21st POST /api/chat in a chat window gets chat_rate_limited", { tag: ["@C4"] }, async ({ request }) => {
  // Up to a minute for a fresh window, 21 requests, then up to a minute's wait.
  test.setTimeout(180_000);
  await waitForFreshChatWindow();
  const post = () =>
    request.post("/api/chat", { headers: { "content-type": "application/json" }, data: `not json ${crypto.randomUUID()}` });

  // 20 invalid requests, which count toward the limit.
  for (let i = 1; i <= 20; i++) {
    const response = await post();
    expect(response.status(), `request ${i}`).toBe(400);
    expect(await response.json()).toEqual(INVALID);
  }

  const limited = await post();
  expect(limited.status()).toBe(429);
  // retryAfterSeconds is server-made: proved by bounds (the 60-second window on a
  // branch environment) and by matching the header.
  const retryAfter = Number(limited.headers()["retry-after"]);
  expect(retryAfter).toBeGreaterThanOrEqual(1);
  expect(retryAfter).toBeLessThanOrEqual(60);
  expect(await limited.json()).toEqual({
    error: "chat_rate_limited",
    message: `Too many questions. Try again in ${retryAfter} seconds.`,
    retryAfterSeconds: retryAfter,
  });

  // Wait out the window, so whatever runs next from this IP starts clean.
  await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
});

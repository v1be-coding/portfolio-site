import type { Project } from "@playwright/test";

// Which test projects run on a target. Acceptance tests run on branch
// environments only, and production keeps the smoke test (Q29). verify.yml sets
// FROZEN_TARGET. Unset, as in a local run, counts as a branch.
//
// chat-rate-limit (spec #2) sends the 21st POST /api/chat in a chat window, so it
// runs after acceptance and never on production.
const CHAT_RATE_LIMIT = /chat-rate-limit\.spec\.ts$/;

export function projectsFor(target: string | undefined): Project[] {
  const onProduction = target === "production";
  const beforeRateLimit = onProduction ? ["smoke"] : ["smoke", "acceptance", "chat-rate-limit"];
  return [
    { name: "smoke", testDir: "smoke", testIgnore: /rate-limit\.spec\.ts/ },
    ...(onProduction
      ? []
      : [
          { name: "acceptance", testDir: "acceptance", testIgnore: CHAT_RATE_LIMIT, dependencies: ["smoke"] },
          { name: "chat-rate-limit", testDir: "acceptance", testMatch: CHAT_RATE_LIMIT, dependencies: ["smoke", "acceptance"] },
        ]),
    // Last, because it uses up this IP's minute on purpose.
    { name: "rate-limit", testDir: "smoke", testMatch: /(^|\/)rate-limit\.spec\.ts$/, dependencies: beforeRateLimit },
  ];
}

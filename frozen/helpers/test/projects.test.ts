import assert from "node:assert/strict";
import { test } from "node:test";
import { projectsFor } from "../projects.ts";

const names = (target: string | undefined) => projectsFor(target).map((p) => p.name);
const project = (target: string | undefined, name: string) => projectsFor(target).find((p) => p.name === name);

test("a branch runs smoke, acceptance, the chat rate limit, then the rate-limit check", () => {
  assert.deepEqual(names("branch"), ["smoke", "acceptance", "chat-rate-limit", "rate-limit"]);
  assert.deepEqual(project("branch", "chat-rate-limit")?.dependencies, ["smoke", "acceptance"]);
  assert.deepEqual(projectsFor("branch").at(-1)?.dependencies, ["smoke", "acceptance", "chat-rate-limit"]);
});

test("an unset target, as in a local run, counts as a branch", () => {
  assert.deepEqual(names(undefined), ["smoke", "acceptance", "chat-rate-limit", "rate-limit"]);
});

test("production leaves acceptance and the chat rate limit out (Q29, spec #2)", () => {
  assert.deepEqual(names("production"), ["smoke", "rate-limit"]);
  assert.deepEqual(projectsFor("production").at(-1)?.dependencies, ["smoke"]);
});

test("the chat rate-limit file runs in its own project, not in acceptance", () => {
  const file = "acceptance/chat-rate-limit.spec.ts";
  const acceptance = project("branch", "acceptance");
  const chat = project("branch", "chat-rate-limit");
  assert.ok(acceptance?.testIgnore instanceof RegExp && acceptance.testIgnore.test(file));
  assert.ok(chat?.testMatch instanceof RegExp && chat.testMatch.test(file));
});

test("the per-IP rate-limit project matches its own file, not the chat rate-limit file", () => {
  const match = project("branch", "rate-limit")?.testMatch;
  assert.ok(match instanceof RegExp);
  assert.equal(match.test("/repo/frozen/smoke/rate-limit.spec.ts"), true);
  assert.equal(match.test("/repo/frozen/acceptance/chat-rate-limit.spec.ts"), false);
});

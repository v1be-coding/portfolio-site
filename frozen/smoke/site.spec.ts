import { expect, test } from "../helpers/fixtures.js";
import { axeViolations, recordConsole } from "../helpers/browser.js";
import { HEADS, ORIGIN, SECURITY_HEADERS, securityHeadersOf } from "../helpers/portfolio.js";
import { unexpectedConsoleErrors } from "../helpers/site.js";

// Spec #2's read-only checks, which run on production too. None sends
// POST /api/chat. Each title starts with the test contract lines it checks.

const HOME = HEADS[0] ?? { path: "/", title: "", description: "", url: "" };

test("C1, C13, C14: /api/health answers with the security and cache headers", { tag: ["@C1", "@C13", "@C14"] }, async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(securityHeadersOf(response.headers())).toEqual(SECURITY_HEADERS);
});

test("C12: an unknown path returns 404", { tag: ["@C12"] }, async ({ request }) => {
  const response = await request.get(`/no-such-page-${crypto.randomUUID()}`);

  expect(response.status()).toBe(404);
});

// The edge maps only S3's 403 to the 404 page, so a missing page gets the HTML
// page and the API's own JSON 404 reaches the client (v1be-infra #61). Branch
// edges map it the same way, so both run on branch and production.
test("an unknown page returns the HTML 404 page", async ({ request }) => {
  const response = await request.get(`/no-such-page-${crypto.randomUUID()}`);

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toMatch(/^text\/html/);
});

test("an unknown API path returns the API's JSON 404", async ({ request }) => {
  const response = await request.get(`/api/no-such-path-${crypto.randomUUID()}`);

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual({ error: "Not found" });
});

test("C11: a trailing slash redirects to the canonical path", { tag: ["@C11"] }, async ({ request }) => {
  const response = await request.get("/v1be-coding/", { maxRedirects: 0 });

  expect(response.status()).toBe(301);
  expect(response.headers()["location"]).toBe("/v1be-coding");
});

test("C51: / has a clean console while loading and opening the Chat", { tag: ["@C51"] }, async ({ page }) => {
  const consoleEntries = recordConsole(page);
  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);

  const tab = page.getByRole("button", { name: "Ask about Emiliano", exact: true });
  await tab.click();
  await expect(page.getByRole("dialog", { name: "Ask about Emiliano" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Ask about Emiliano" })).toBeHidden();

  expect(unexpectedConsoleErrors(consoleEntries)).toEqual([]);
});

test("C50: axe finds no violations on /", { tag: ["@C50"] }, async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Ask about Emiliano", exact: true })).toBeVisible();

  expect(await axeViolations(page)).toEqual([]);
});

test.describe("raw HTML, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("C15, C16, C17: / has its head metadata", { tag: ["@C15", "@C16", "@C17"] }, async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", "width=device-width, initial-scale=1");
    await expect(page.locator('link[rel="icon"][href="/favicon.svg"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"][href="/apple-touch-icon.png"]')).toHaveCount(1);
    await expect(page).toHaveTitle(HOME.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", HOME.description);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", HOME.url);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", HOME.url);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", HOME.title);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", HOME.description);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `${ORIGIN}/og.png`);
  });
});

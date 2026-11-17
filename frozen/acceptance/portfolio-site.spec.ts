import type { APIRequestContext, Page, Route } from "@playwright/test";
import { expect, test } from "../helpers/fixtures.js";
import {
  axeViolations,
  focusIsVisible,
  fontState,
  installPerformanceProbe,
  motionStyles,
  overflowsSideways,
  readEventTiming,
  readPdf,
  readPerformance,
  recordConsole,
  recordRequests,
  recordScriptBytes,
  tabToChatTab,
  waitForFreshChatWindow,
} from "../helpers/browser.js";
import {
  AVAILABILITY,
  BIO,
  CHAT,
  EDUCATION,
  EMAIL,
  EPISODE_0_DESCRIPTION,
  EPISODE_0_SUMMARY,
  EPISODE_SENTENCE,
  EXPERIENCE,
  GITHUB,
  GREETING_ONLY,
  HEADS,
  LINKEDIN,
  NAME,
  NOT_FOUND_TEXT,
  NOT_FOUND_TITLE,
  ORIGIN,
  RESUME_SEQUENCE,
  SECURITY_HEADERS,
  SERIES_INTRO,
  SERIES_STEPS,
  SKILLS,
  TAGLINE,
  experienceSequence,
  securityHeadersOf,
} from "../helpers/portfolio.js";
import {
  cumulativeLayoutShift,
  firstFontFamily,
  firstInputDuration,
  hasLoadedSwapFace,
  internalLinks,
  mediaType,
  movingElements,
  orderProblems,
  squash,
  totalBlockingTime,
  unexpectedConsoleErrors,
  unexpectedRequestFailures,
} from "../helpers/site.js";

// Spec #2: the portfolio site. Each title starts with the test contract lines
// (in the spec issue) that it checks.

const REAL_PAGES = ["/", "/v1be-coding", "/v1be-coding/portfolio-site"];
// Each page to visit, by name. The unknown path is new for every test.
type Target = { name: string; path: () => string };
const NON_HOME_PAGES: Target[] = [
  { name: "/v1be-coding", path: () => "/v1be-coding" },
  { name: "/v1be-coding/portfolio-site", path: () => "/v1be-coding/portfolio-site" },
  { name: "an unknown path", path: () => unknownPath() },
];
const ALL_PAGES: Target[] = [{ name: "/", path: () => "/" }, ...NON_HOME_PAGES];
const unknownPath = () => `/no-such-page-${crypto.randomUUID()}`;
const INVALID = { error: "invalid_request", message: "Invalid conversation" };

// The Chat, as a visitor finds it.
const chatTab = (page: Page) => page.getByRole("button", { name: CHAT.name, exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: CHAT.name });
const log = (page: Page) => dialog(page).getByRole("log", { name: "Conversation" });
const textbox = (page: Page) => dialog(page).getByRole("textbox", { name: "Your question" });
const sendButton = (page: Page) => dialog(page).getByRole("button", { name: "Send", exact: true });
const status = (page: Page) => dialog(page).getByRole("status");
const siteNav = (page: Page) => page.getByRole("navigation", { name: "Site" });
const isChatPost = (response: { url(): string; request(): { method(): string } }) =>
  new URL(response.url()).pathname === "/api/chat" && response.request().method() === "POST";

async function openChat(page: Page): Promise<void> {
  await chatTab(page).click();
  await expect(dialog(page)).toBeVisible();
}

async function ask(page: Page, question: string): Promise<void> {
  await textbox(page).fill(question);
  await sendButton(page).click();
}

// Answers /api/chat in the browser, so no request reaches the server or the model.
async function fakeChat(page: Page, status: number, body: unknown, headers: Record<string, string> = {}): Promise<void> {
  await page.route("**/api/chat", (route: Route) =>
    route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

const postChat = (request: APIRequestContext, body: string) =>
  request.post("/api/chat", { headers: { "content-type": "application/json" }, data: body });

// ---------------------------------------------------------------- Routes

test("C1, C13, C14: /api/health answers ok with the security and cache headers", { tag: ["@C1", "@C13", "@C14"] }, async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(securityHeadersOf(response.headers())).toEqual(SECURITY_HEADERS);
});

test("C3: each of the 8 invalid conversations gets the invalid_request 400", { tag: ["@C3"] }, async ({ request }) => {
  const user = (content: string) => ({ role: "user", content });
  const ref = crypto.randomUUID();
  const bodies = [
    `not json ${ref}`,
    JSON.stringify([user(`hi ${ref}`)]),
    JSON.stringify({ messages: [user(`hi ${ref}`)], extra: true }),
    JSON.stringify({ messages: [] }),
    JSON.stringify({
      messages: Array.from({ length: 30 }, (_, i) => ({ role: ["user", "assistant"][i % 2], content: `message ${i} ${ref}` })),
    }),
    JSON.stringify({ messages: [{ role: "system", content: `hi ${ref}` }] }),
    JSON.stringify({ messages: [{ role: "assistant", content: `hello ${ref}` }, user(`hi ${ref}`)] }),
    JSON.stringify({ messages: [user(`${ref} `.padEnd(501, "a"))] }),
  ];
  expect(bodies).toHaveLength(8);

  for (const body of bodies) {
    const response = await postChat(request, body);
    expect(response.status(), body.slice(0, 60)).toBe(400);
    expect(await response.json()).toEqual(INVALID);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  }
});

test("C5: other methods on /api/chat return 405", { tag: ["@C5"] }, async ({ request }) => {
  const notAllowed = { error: "Method not allowed" };
  const data = { messages: [{ role: "user", content: `hi ${crypto.randomUUID()}` }] };

  const get = await request.get("/api/chat");
  expect(get.status()).toBe(405);
  expect(await get.json()).toEqual(notAllowed);

  const put = await request.put("/api/chat", { data });
  expect(put.status()).toBe(405);
  expect(await put.json()).toEqual(notAllowed);

  const patch = await request.patch("/api/chat", { data });
  expect(patch.status()).toBe(405);
  expect(await patch.json()).toEqual(notAllowed);

  const remove = await request.delete("/api/chat");
  expect(remove.status()).toBe(405);
  expect(await remove.json()).toEqual(notAllowed);
});

test("C6: /resume.pdf is a PDF", { tag: ["@C6"] }, async ({ request }) => {
  const response = await request.get("/resume.pdf");

  expect(response.status()).toBe(200);
  expect(mediaType(response.headers()["content-type"])).toBe("application/pdf");
  expect([...(await response.body()).subarray(0, 5)]).toEqual([...Buffer.from("%PDF-")]);
});

test("C7: the resume PDF holds the site's content and no phone number", { tag: ["@C7"] }, async ({ request }) => {
  const response = await request.get("/resume.pdf");
  expect(response.status()).toBe(200);
  const pages = await readPdf(await response.body());

  expect(pages.length).toBeGreaterThanOrEqual(1);
  expect(pages.length).toBeLessThanOrEqual(2);
  for (const page of pages) {
    expect(Math.abs(page.width - 595)).toBeLessThanOrEqual(1);
    expect(Math.abs(page.height - 842)).toBeLessThanOrEqual(1);
  }
  const text = pages.map((page) => page.text).join(" ");
  const squashed = squash(text);
  expect(squash(pages[0]?.text ?? "")).toContain(squash(NAME));
  expect(orderProblems(squashed, ["Experience", "Skills", "Education"])).toEqual([]);
  expect(orderProblems(squashed, ["Experience", ...RESUME_SEQUENCE].map(squash))).toEqual([]);
  expect(squashed).toContain(EMAIL);
  expect(squashed).toContain("github.com/emilianocasijr");
  expect(squashed).toContain("linkedin.com/in/emiliano-casi-jr");
  expect(text).not.toContain("950");
  expect(text).not.toContain("+63");
  expect(text).not.toContain("3959");
});

test("C8: /robots.txt allows everything and names the sitemap", { tag: ["@C8"] }, async ({ request }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  expect(mediaType(response.headers()["content-type"])).toBe("text/plain");
  expect((await response.text()).replace(/\n$/, "")).toBe(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml`);
});

test("C9: /sitemap.xml lists the three pages in order", { tag: ["@C9"] }, async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  const locs = [...(await response.text()).matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((match) => match[1]);
  expect(locs).toEqual([`${ORIGIN}/`, `${ORIGIN}/v1be-coding`, `${ORIGIN}/v1be-coding/portfolio-site`]);
});

test("C10: the Open Graph image and icons are served with their types", { tag: ["@C10"] }, async ({ request }) => {
  const og = await request.get("/og.png");
  expect(og.status()).toBe(200);
  expect(mediaType(og.headers()["content-type"])).toBe("image/png");

  const touch = await request.get("/apple-touch-icon.png");
  expect(touch.status()).toBe(200);
  expect(mediaType(touch.headers()["content-type"])).toBe("image/png");

  const favicon = await request.get("/favicon.svg");
  expect(favicon.status()).toBe(200);
  expect(mediaType(favicon.headers()["content-type"])).toBe("image/svg+xml");
  expect(await favicon.text()).not.toContain("<text");
});

test("C11: a trailing slash redirects to the canonical path", { tag: ["@C11"] }, async ({ request }) => {
  const series = await request.get("/v1be-coding/", { maxRedirects: 0 });
  expect(series.status()).toBe(301);
  expect(series.headers()["location"]).toBe("/v1be-coding");

  const episode = await request.get("/v1be-coding/portfolio-site/", { maxRedirects: 0 });
  expect(episode.status()).toBe(301);
  expect(episode.headers()["location"]).toBe("/v1be-coding/portfolio-site");
});

test("C12: unknown paths and unknown Episode slugs return 404 with the 404 page", { tag: ["@C12"] }, async ({ request }) => {
  const unknown = await request.get(unknownPath());
  expect(unknown.status()).toBe(404);
  expect(await unknown.text()).toContain(`<title>${NOT_FOUND_TITLE}</title>`);

  const episode = await request.get(`/v1be-coding/no-such-episode-${crypto.randomUUID()}`);
  expect(episode.status()).toBe(404);
  expect(await episode.text()).toContain(`<title>${NOT_FOUND_TITLE}</title>`);
});

test("C13: every HTML page has the security headers", { tag: ["@C13"] }, async ({ request }) => {
  for (const path of REAL_PAGES) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(securityHeadersOf(response.headers()), path).toEqual(SECURITY_HEADERS);
  }
  const unknown = await request.get(unknownPath());
  expect(unknown.status()).toBe(404);
  expect(securityHeadersOf(unknown.headers())).toEqual(SECURITY_HEADERS);
});

test("C14: pages aren't cached, hashed assets are cached for a year", { tag: ["@C14"] }, async ({ request }) => {
  for (const path of REAL_PAGES) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"], path).toBe("no-cache");
  }
  const home = await (await request.get("/")).text();
  const asset = /\/assets\/[^"'\s>]+/.exec(home)?.[0];
  expect(asset).toBeDefined();
  const response = await request.get(asset ?? "/assets/none");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
});

// ---------------------------------------------------------------- Head metadata

test.describe("raw HTML, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const head of HEADS) {
    test(`C15, C16, C17: ${head.path} has its head metadata`, { tag: ["@C15", "@C16", "@C17"] }, async ({ page }) => {
      const response = await page.goto(head.path);
      expect(response?.status()).toBe(200);

      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", "width=device-width, initial-scale=1");
      await expect(page.locator('link[rel="icon"][href="/favicon.svg"][type="image/svg+xml"]')).toHaveCount(1);
      await expect(page.locator('link[rel="apple-touch-icon"][href="/apple-touch-icon.png"]')).toHaveCount(1);

      await expect(page).toHaveTitle(head.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", head.description);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", head.url);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", head.url);

      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", head.title);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", head.description);
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `${ORIGIN}/og.png`);
    });
  }

  test("C15, C16: the 404 page has its head metadata and noindex", { tag: ["@C15", "@C16"] }, async ({ page }) => {
    const response = await page.goto(unknownPath());
    expect(response?.status()).toBe(404);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", "width=device-width, initial-scale=1");
    await expect(page.locator('link[rel="icon"][href="/favicon.svg"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"][href="/apple-touch-icon.png"]')).toHaveCount(1);

    await expect(page).toHaveTitle(NOT_FOUND_TITLE);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", NOT_FOUND_TEXT);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });
});

// ---------------------------------------------------------------- Shell

for (const target of ALL_PAGES) {
  test(`C18, C21: on ${target.name}, Skip to content comes first, and the contact links and Chat tab are there`, { tag: ["@C18", "@C21"] }, async ({ page }) => {
    await page.goto(target.path());

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    const mainId = await page.locator("main").getAttribute("id");
    await expect(skip).toHaveAttribute("href", `#${mainId}`);

    await expect(page.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", GITHUB);
    await expect(page.getByRole("link", { name: "LinkedIn", exact: true })).toHaveAttribute("href", LINKEDIN);
    await expect(page.getByRole("link", { name: "Email me", exact: true })).toHaveAttribute("href", `mailto:${EMAIL}`);
    const resume = page.getByRole("link", { name: "Download resume", exact: true });
    await expect(resume).toHaveAttribute("href", "/resume.pdf");
    await expect(resume).toHaveAttribute("download");
    await expect(chatTab(page)).toBeVisible();
  });
}

test("C19, C20: on /, the name is the h1, with the tagline, availability and Site nav", { tag: ["@C19", "@C20"] }, async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: NAME, exact: true })).toBeVisible();
  await expect(page.getByText(TAGLINE, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(AVAILABILITY, { exact: true }).first()).toBeVisible();
  const home = siteNav(page).getByRole("link", { name: "Home", exact: true });
  const series = siteNav(page).getByRole("link", { name: "V1be Coding", exact: true });
  await expect(home).toHaveAttribute("href", "/");
  await expect(series).toHaveAttribute("href", "/v1be-coding");
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(series).not.toHaveAttribute("aria-current", "page");
});

test("C19, C20: on /v1be-coding, V1be Coding is the current page in the Site nav", { tag: ["@C19", "@C20"] }, async ({ page }) => {
  await page.goto("/v1be-coding");

  const home = siteNav(page).getByRole("link", { name: "Home", exact: true });
  const series = siteNav(page).getByRole("link", { name: "V1be Coding", exact: true });
  await expect(home).toHaveAttribute("href", "/");
  await expect(series).toHaveAttribute("href", "/v1be-coding");
  await expect(series).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current", "page");
});

for (const target of NON_HOME_PAGES) {
  test(`C19, C20: on ${target.name}, the name links home, with the tagline, availability and Site nav`, { tag: ["@C19", "@C20"] }, async ({ page }) => {
    await page.goto(target.path());

    await expect(page.getByRole("link", { name: NAME, exact: true })).toHaveAttribute("href", "/");
    await expect(page.getByText(TAGLINE, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(AVAILABILITY, { exact: true }).first()).toBeVisible();
    await expect(siteNav(page).getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
    await expect(siteNav(page).getByRole("link", { name: "V1be Coding", exact: true })).toHaveAttribute("href", "/v1be-coding");
  });
}

// ---------------------------------------------------------------- Home

test("C22, C23: the home page has its section links and sections", { tag: ["@C22", "@C23"] }, async ({ page }) => {
  await page.goto("/");

  const onThisPage = page.getByRole("navigation", { name: "On this page" });
  for (const [name, id] of [
    ["About", "about"],
    ["Experience", "experience"],
    ["Skills", "skills"],
    ["Education", "education"],
  ]) {
    await expect(onThisPage.getByRole("link", { name, exact: true })).toHaveAttribute("href", `#${id}`);
    await expect(page.locator(`section#${id}`).getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
});

test("C24: About shows the bio and links Episode 0", { tag: ["@C24"] }, async ({ page }) => {
  await page.goto("/");

  const about = page.locator("section#about");
  await expect(about).toContainText(BIO);
  await expect(about).toContainText(EPISODE_SENTENCE);
  await expect(about.getByRole("link", { name: "Episode 0 of V1be Coding", exact: true })).toHaveAttribute(
    "href",
    "/v1be-coding/portfolio-site",
  );
});

test("C25: Experience lists each role and Engagement, newest first, exactly as written", { tag: ["@C25"] }, async ({ page }) => {
  await page.goto("/");

  const experience = page.locator("section#experience");
  await expect(experience.getByRole("heading", { level: 3 })).toHaveText(EXPERIENCE.map((role) => role.heading));
  for (const role of EXPERIENCE) {
    const article = experience.getByRole("article").filter({ has: page.getByRole("heading", { level: 3, name: role.heading, exact: true }) });
    await expect(article).toBeVisible();
    await expect(article.getByRole("heading", { level: 4 })).toHaveText(role.engagements.map((engagement) => engagement.name));
    expect(orderProblems(squash((await article.textContent()) ?? ""), experienceSequence(role).map(squash))).toEqual([]);
  }
});

test("C26, C27: Skills and Education are exactly as written", { tag: ["@C26", "@C27"] }, async ({ page }) => {
  await page.goto("/");

  const skills = page.locator("section#skills");
  await expect(skills).toBeVisible();
  const expected = SKILLS.flatMap((group) => [group.label, ...group.items]);
  expect(orderProblems(squash((await skills.textContent()) ?? ""), expected.map(squash))).toEqual([]);
  await expect(page.locator("section#education")).toContainText(EDUCATION);
});

test("C28, C55: Tab goes through the shell in order, and every stop shows focus", { tag: ["@C28", "@C55"] }, async ({ page }) => {
  await page.goto("/");

  const onThisPage = page.getByRole("navigation", { name: "On this page" });
  const stops = [
    page.getByRole("link", { name: "Skip to content" }),
    siteNav(page).getByRole("link", { name: "Home", exact: true }),
    siteNav(page).getByRole("link", { name: "V1be Coding", exact: true }),
    onThisPage.getByRole("link", { name: "About", exact: true }),
    onThisPage.getByRole("link", { name: "Experience", exact: true }),
    onThisPage.getByRole("link", { name: "Skills", exact: true }),
    onThisPage.getByRole("link", { name: "Education", exact: true }),
    page.getByRole("link", { name: "GitHub", exact: true }),
    page.getByRole("link", { name: "LinkedIn", exact: true }),
    page.getByRole("link", { name: "Email me", exact: true }),
    page.getByRole("link", { name: "Download resume", exact: true }),
  ];
  for (const stop of stops) {
    await page.keyboard.press("Tab");
    await expect(stop).toBeFocused();
    await expect.poll(() => focusIsVisible(page)).toBe(true);
  }
});

test("C56: at 320px, tabbing reaches the Chat tab and no stop hides under it", { tag: ["@C56"] }, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(chatTab(page)).toBeVisible();

  const walk = await tabToChatTab(page, chatTab(page));

  expect(walk.reachedChatTab).toBe(true);
  expect(walk.covered).toEqual([]);
});

// ---------------------------------------------------------------- Series and Episode

test("C29, C30: the Series page explains the Series and lists Episode 0", { tag: ["@C29", "@C30"] }, async ({ page }) => {
  await page.goto("/v1be-coding");

  await expect(page.getByRole("heading", { level: 1, name: "V1be Coding", exact: true })).toBeVisible();
  await expect(page.getByText(SERIES_INTRO, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "How it works", exact: true })).toBeVisible();
  await expect(page.locator("ol").filter({ hasText: "Frozen tests." }).getByRole("listitem")).toHaveText(SERIES_STEPS);
  await expect(page.getByRole("heading", { level: 2, name: "Episodes", exact: true })).toBeVisible();

  const episodeLink = page.getByRole("link", { name: "Episode 0: Portfolio site", exact: true });
  await expect(episodeLink).toHaveAttribute("href", "/v1be-coding/portfolio-site");
  const item = page.getByRole("listitem").filter({ has: episodeLink });
  await expect(item).toContainText(EPISODE_0_SUMMARY);
  await expect(item).toContainText("Scorecard: in progress");
});

test("C31, C32, C33: the Episode page has its sections, links and placeholders", { tag: ["@C31", "@C32", "@C33"] }, async ({ page }) => {
  await page.goto("/v1be-coding/portfolio-site");

  await expect(page.getByRole("heading", { level: 1, name: "Portfolio site", exact: true })).toBeVisible();
  await expect(page.getByText("Episode 0", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
    "About this episode",
    "Demo",
    "Links",
    "Scorecard",
    "How it works",
    "Retro",
  ]);

  await expect(page.getByText(EPISODE_0_DESCRIPTION, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Live site", exact: true })).toHaveAttribute("href", "https://emilianocasijr.com");
  await expect(page.getByRole("link", { name: "Repository", exact: true })).toHaveAttribute(
    "href",
    "https://github.com/v1be-coding/portfolio-site",
  );
  await expect(page.getByRole("link", { name: "Spec issue", exact: true })).toHaveAttribute(
    "href",
    "https://github.com/v1be-coding/portfolio-site/issues/2",
  );
  await expect(page.getByText("In progress. The Scorecard is added when the episode ends.", { exact: true })).toBeVisible();
  await expect(page.getByText("Added after the episode.", { exact: true })).toHaveCount(3);
});

test("C34: an unknown path shows the 404 page", { tag: ["@C34"] }, async ({ page }) => {
  const response = await page.goto(unknownPath());

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: NOT_FOUND_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the home page", exact: true })).toHaveAttribute("href", "/");
});

// ---------------------------------------------------------------- Chat

test("C35, C36, C37: the Chat tab opens and closes the panel, and focus follows", { tag: ["@C35", "@C36", "@C37"] }, async ({ page }) => {
  await page.goto("/");
  const tab = chatTab(page);

  await expect(tab).toHaveAttribute("aria-expanded", "false");
  await tab.click();
  await expect(dialog(page)).toBeVisible();
  await expect(tab).toHaveAttribute("aria-expanded", "true");
  await expect(textbox(page)).toBeFocused();

  await expect(dialog(page).getByText(CHAT.subtitle, { exact: true })).toBeVisible();
  await expect(log(page)).toHaveText(GREETING_ONLY);
  await expect(textbox(page)).toHaveAttribute("maxlength", "500");
  await expect(sendButton(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(tab).toBeFocused();
  await expect(tab).toHaveAttribute("aria-expanded", "false");

  await tab.click();
  await expect(textbox(page)).toBeFocused();
  await dialog(page).getByRole("button", { name: "Close chat", exact: true }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(tab).toBeFocused();

  await tab.click();
  await expect(dialog(page)).toBeVisible();
  await tab.click();
  await expect(dialog(page)).toBeHidden();
  await expect(tab).toBeFocused();
  await expect(tab).toHaveAttribute("aria-expanded", "false");
});

test("C38, C41: suggested questions show until the first send", { tag: ["@C38", "@C41"] }, async ({ page }) => {
  const reply = `Faked reply ${crypto.randomUUID()}`;
  await fakeChat(page, 200, { reply });
  await page.goto("/");
  await openChat(page);

  for (const suggestion of CHAT.suggestions) {
    await expect(dialog(page).getByRole("button", { name: suggestion, exact: true })).toBeVisible();
  }
  const question = `What did Emiliano build at WebMD? ${crypto.randomUUID()}`;
  await ask(page, question);

  await expect(log(page)).toContainText(`You: ${question}`);
  await expect(log(page)).toContainText(`Assistant: ${reply}`);
  for (const suggestion of CHAT.suggestions) {
    await expect(dialog(page).getByRole("button", { name: suggestion, exact: true })).toHaveCount(0);
  }
});

test("C39: the textbox is disabled until /api/health succeeds", { tag: ["@C39"] }, async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/health", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/");
  await openChat(page);

  await expect(textbox(page)).toBeDisabled();
  release();
  await expect(textbox(page)).toBeEnabled();
});

test("C40: Thinking… shows and Send is disabled while a reply is pending", { tag: ["@C40"] }, async ({ page }) => {
  const reply = `Faked reply ${crypto.randomUUID()}`;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply }) });
  });
  await page.goto("/");
  await openChat(page);
  await expect(textbox(page)).toBeEnabled();

  await ask(page, `Where has Emiliano worked? ${crypto.randomUUID()}`);

  await expect(status(page)).toContainText("Thinking…");
  await expect(sendButton(page)).toBeDisabled();
  release();
  await expect(log(page)).toContainText(`Assistant: ${reply}`);
  await expect(status(page)).not.toContainText("Thinking…");
});

test(
  "C2, C41, C42, C43: real questions get real replies, survive navigation, fill the log, and clear on Start over and reload",
  { tag: ["@C2", "@C41", "@C42", "@C43"] },
  async ({ page }) => {
    // A fresh chat window, 16 replies from the model, and a wait for the next window.
    test.setTimeout(300_000);
    await waitForFreshChatWindow();
    await page.goto("/");
    await openChat(page);
    await expect(textbox(page)).toBeEnabled();

    // 1. One question, with the response checked (C2) and the log checked (C41).
    const first = `What does Emiliano work on? (ref ${crypto.randomUUID()})`;
    const firstResponse = page.waitForResponse(isChatPost);
    await ask(page, first);
    const response = await firstResponse;
    expect(response.status()).toBe(200);
    expect(mediaType(response.headers()["content-type"])).toBe("application/json");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    const body = (await response.json()) as { reply: string };
    expect(typeof body.reply).toBe("string");
    expect(body.reply.length).toBeGreaterThanOrEqual(1);
    expect(body.reply.length).toBeLessThanOrEqual(4000);
    expect(body).toEqual({ reply: body.reply });
    await expect(log(page)).toContainText(`You: ${first}`);
    await expect.poll(async () => squash((await log(page).textContent()) ?? "")).toContain(squash(`Assistant: ${body.reply}`));

    // 2. Client-side navigation keeps the conversation (C42).
    await page.evaluate(() => {
      (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
    });
    await dialog(page).getByRole("button", { name: "Close chat", exact: true }).click();
    await siteNav(page).getByRole("link", { name: "V1be Coding", exact: true }).click();
    await expect(page).toHaveURL(/\/v1be-coding$/);
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
    await openChat(page);
    await expect(log(page)).toContainText(`You: ${first}`);

    // 3. Fill the log to 30 messages: 14 more questions (C41, C43).
    const questions = ["Where has Emiliano worked?", "What is V1be Coding?", "Which skills does Emiliano have?", "How can I contact Emiliano?"];
    for (let i = 0; i < 14; i++) {
      const question = `${questions[i % questions.length]} (ref ${crypto.randomUUID()})`;
      const answer = page.waitForResponse(isChatPost);
      await ask(page, question);
      const answered = await answer;
      expect(answered.status()).toBe(200);
      const { reply } = (await answered.json()) as { reply: string };
      await expect(log(page)).toContainText(`You: ${question}`);
      await expect.poll(async () => squash((await log(page).textContent()) ?? "")).toContain(squash(`Assistant: ${reply}`));
    }
    await expect(dialog(page).getByText("This conversation is full.", { exact: true })).toBeVisible();
    await expect(textbox(page)).toBeDisabled();
    await expect(sendButton(page)).toBeDisabled();

    // 4. Start over (C43).
    await dialog(page).getByRole("button", { name: "Start over", exact: true }).click();
    await expect(log(page)).toHaveText(GREETING_ONLY);
    await expect(textbox(page)).toBeEnabled();

    // 5. One more question, then a reload clears it (C42).
    const last = `What is V1be Coding? (ref ${crypto.randomUUID()})`;
    const lastResponse = page.waitForResponse(isChatPost);
    await ask(page, last);
    expect((await lastResponse).status()).toBe(200);
    await expect(log(page)).toContainText(`You: ${last}`);
    await page.reload();
    await openChat(page);
    await expect(log(page)).toHaveText(GREETING_ONLY);

    // Whatever runs next from this IP starts in a fresh chat window.
    await waitForFreshChatWindow();
  },
);

// ---------------------------------------------------------------- Chat error states (faked)

test.describe("chat error states", () => {
  // The 429s here come from page.route, not the server.
  test.use({ allow429: true });

  test("C44: a rate-limited /api/health shows the per-IP limit message", { tag: ["@C44"] }, async ({ page }) => {
    await page.route("**/api/health", (route) =>
      route.fulfill({
        status: 429,
        headers: { "retry-after": "30" },
        contentType: "application/json",
        body: JSON.stringify({ error: "rate_limited", message: "Too many requests", retryAfterSeconds: 30 }),
      }),
    );
    await page.goto("/");
    await openChat(page);

    await expect(status(page)).toContainText("Too many requests. Try again in 30 seconds.");
  });

  test("C44: a rate-limited /api/chat shows the per-IP limit message", { tag: ["@C44"] }, async ({ page }) => {
    await fakeChat(page, 429, { error: "rate_limited", message: "Too many requests", retryAfterSeconds: 37 }, { "retry-after": "37" });
    await page.goto("/");
    await openChat(page);
    await expect(textbox(page)).toBeEnabled();

    await ask(page, `Where has Emiliano worked? ${crypto.randomUUID()}`);

    await expect(status(page)).toContainText("Too many requests. Try again in 37 seconds.");
  });

  test("C45: chat_rate_limited shows the questions limit message", { tag: ["@C45"] }, async ({ page }) => {
    await fakeChat(
      page,
      429,
      { error: "chat_rate_limited", message: "Too many questions. Try again in 42 seconds.", retryAfterSeconds: 42 },
      { "retry-after": "42" },
    );
    await page.goto("/");
    await openChat(page);
    await expect(textbox(page)).toBeEnabled();

    await ask(page, `Where has Emiliano worked? ${crypto.randomUUID()}`);

    await expect(status(page)).toContainText("Too many questions. Try again in 42 seconds.");
  });

  test("C46: daily_cap shows the paused message and an email link", { tag: ["@C46"] }, async ({ page }) => {
    await fakeChat(
      page,
      429,
      { error: "daily_cap", message: "The AI feature is paused until tomorrow", retryAfterSeconds: 3600 },
      { "retry-after": "3600" },
    );
    await page.goto("/");
    await openChat(page);
    await expect(textbox(page)).toBeEnabled();

    await ask(page, `Where has Emiliano worked? ${crypto.randomUUID()}`);

    await expect(status(page)).toContainText("The AI feature is paused until tomorrow.");
    await expect(status(page).getByRole("link", { name: "Email me instead", exact: true })).toHaveAttribute("href", `mailto:${EMAIL}`);
  });

  test("C47: ai_busy shows the busy message and puts the question back", { tag: ["@C47"] }, async ({ page }) => {
    await fakeChat(page, 503, { error: "ai_busy", message: "The AI is busy. Try again in a minute." });
    await page.goto("/");
    await openChat(page);
    await expect(textbox(page)).toBeEnabled();
    const question = `Where has Emiliano worked? ${crypto.randomUUID()}`;

    await ask(page, question);

    await expect(status(page)).toContainText("The Chat is busy right now. Try again in a minute.");
    await expect(textbox(page)).toHaveValue(question);
    await expect(log(page)).not.toContainText(question);
  });

  test("C48: a failed /api/health shows the Chat as unavailable", { tag: ["@C48"] }, async ({ page }) => {
    await page.route("**/api/health", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal error" }) }),
    );
    await page.goto("/");
    await openChat(page);
    await expect(status(page)).toContainText("The Chat is unavailable right now.");
    await expect(textbox(page)).toBeDisabled();

    await page.unroute("**/api/health");
    await page.route("**/api/health", (route) => route.abort("failed"));
    await page.reload();
    await openChat(page);
    await expect(status(page)).toContainText("The Chat is unavailable right now.");
    await expect(textbox(page)).toBeDisabled();
  });

  test("C49: a failed /api/chat says the message didn't send and puts it back", { tag: ["@C49"] }, async ({ page }) => {
    await fakeChat(page, 500, { error: "server_error", message: "Something went wrong" });
    await page.goto("/");
    await openChat(page);
    await expect(textbox(page)).toBeEnabled();
    const question = `Where has Emiliano worked? ${crypto.randomUUID()}`;
    await ask(page, question);
    await expect(status(page)).toContainText("Your message didn't send. Try again.");
    await expect(textbox(page)).toHaveValue(question);
    await expect(log(page)).not.toContainText(question);

    await page.unroute("**/api/chat");
    await page.route("**/api/chat", (route) => route.abort("failed"));
    const again = `Which skills does Emiliano have? ${crypto.randomUUID()}`;
    await ask(page, again);
    await expect(status(page)).toContainText("Your message didn't send. Try again.");
    await expect(textbox(page)).toHaveValue(again);
    await expect(log(page)).not.toContainText(again);
  });
});

// ---------------------------------------------------------------- Quality checks

for (const path of REAL_PAGES) {
  test(`C50: axe finds no violations on ${path}`, { tag: ["@C50"] }, async ({ page }) => {
    await page.goto(path);
    await expect(chatTab(page)).toBeVisible();

    expect(await axeViolations(page)).toEqual([]);
  });
}

test("C50: axe finds no violations on an unknown path", { tag: ["@C50"] }, async ({ page }) => {
  await page.goto(unknownPath());
  await expect(chatTab(page)).toBeVisible();

  expect(await axeViolations(page)).toEqual([]);
});

test("C50: axe finds no violations on / with the Chat open", { tag: ["@C50"] }, async ({ page }) => {
  await page.goto("/");
  await openChat(page);
  await expect(textbox(page)).toBeEnabled();

  expect(await axeViolations(page)).toEqual([]);
});

for (const path of REAL_PAGES) {
  test(`C51, C52: ${path} loads and opens the Chat with a clean console and no failed requests`, { tag: ["@C51", "@C52"] }, async ({ page, baseURL }) => {
    const consoleEntries = recordConsole(page);
    const requests = recordRequests(page);

    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    expect(unexpectedRequestFailures([...requests], new URL(baseURL ?? "").origin)).toEqual([]);

    await openChat(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    expect(unexpectedConsoleErrors(consoleEntries)).toEqual([]);
  });
}

test("C51, C52: an unknown path has only its own 404 in the console and requests", { tag: ["@C51", "@C52"] }, async ({ page, baseURL }) => {
  const consoleEntries = recordConsole(page);
  const requests = recordRequests(page);
  const url = new URL(unknownPath(), baseURL).href;

  const response = await page.goto(url, { waitUntil: "networkidle" });
  expect(response?.status()).toBe(404);
  expect(unexpectedRequestFailures([...requests], new URL(url).origin, url)).toEqual([]);

  await openChat(page);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(unexpectedConsoleErrors(consoleEntries, url)).toEqual([]);
});

for (const target of ALL_PAGES) {
  test(`C53, C54: ${target.name} reflows at 320px and its internal links work`, { tag: ["@C53", "@C54"] }, async ({ page, request }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(target.path());
    await expect(chatTab(page)).toBeVisible();

    const { scrollWidth, clientWidth } = await overflowsSideways(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    const links = internalLinks(hrefs, page.url());
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect((await request.get(link)).status(), link).toBe(200);
    }
  });
}

for (const target of ALL_PAGES) {
  test(`C57, C58: on ${target.name}, reduced motion stops all motion and the font is loaded`, { tag: ["@C57", "@C58"] }, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(target.path());
    await expect(chatTab(page)).toBeVisible();

    expect(movingElements(await motionStyles(page))).toEqual([]);
    await openChat(page);
    expect(movingElements(await motionStyles(page))).toEqual([]);

    const fonts = await fontState(page);
    expect(hasLoadedSwapFace(fonts.faces, "Atkinson Hyperlegible Next")).toBe(true);
    expect(firstFontFamily(fonts.bodyFontFamily)).toBe("Atkinson Hyperlegible Next");
  });
}

test(
  "C59, C60, C61, C62, C63, C64: one cold load of / is small, stable, fast and responsive",
  { tag: ["@C59", "@C60", "@C61", "@C62", "@C63", "@C64"] },
  async ({ page, baseURL }) => {
    await installPerformanceProbe(page);
    const scriptBytes = recordScriptBytes(page, new URL(baseURL ?? "").origin);

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(chatTab(page)).toBeVisible();
    await page.waitForTimeout(1000);

    expect(await scriptBytes()).toBeLessThanOrEqual(174_080);
    const perf = await readPerformance(page);
    expect(cumulativeLayoutShift(perf.shifts)).toBeLessThanOrEqual(0.1);
    expect(perf.lcp.length).toBeGreaterThanOrEqual(1);
    expect(perf.lcp.at(-1) ?? Number.POSITIVE_INFINITY).toBeLessThan(2500);
    expect(perf.loadEventStart).toBeGreaterThan(0);
    expect(totalBlockingTime(perf.longTasks, perf.loadEventStart)).toBeLessThanOrEqual(200);
    await expect(page.locator("img:not([width]), img:not([height])")).toHaveCount(0);

    await chatTab(page).click();
    await expect(dialog(page)).toBeVisible();
    await page.waitForTimeout(500);
    const timing = await readEventTiming(page);
    const duration = firstInputDuration(timing.firstInput, timing.events);
    expect(duration).not.toBeNull();
    expect(duration ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(200);
  },
);

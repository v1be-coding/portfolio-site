// Pure logic for the portfolio-site acceptance tests (spec #2). Everything here
// that branches has a unit test in helpers/test/site.test.ts, so the tests
// themselves stay one straight line.

// The media type of a content-type header: the part before any `;`, lower-cased
// ("Content types" in spec #2's test contract).
export function mediaType(header: string | undefined): string {
  return (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

// The chat window on a branch environment: a fixed 60 seconds that starts on the
// minute in UTC. A margin covers a small clock difference between the runner and
// the server.
export const CHAT_WINDOW = { ms: 60_000, marginMs: 2_000 };

// How long to wait until a fresh chat window has started. Always the next
// boundary, never the current window, which earlier requests may have used.
export function msUntilFreshWindow(now: number, windowMs = CHAT_WINDOW.ms, marginMs = CHAT_WINDOW.marginMs): number {
  return windowMs - (now % windowMs) + marginMs;
}

// The needles that don't appear in `text` in the order given. Each search starts
// after the previous match; a missing needle is reported and the search goes on
// from the same place.
export function orderProblems(text: string, needles: readonly string[]): string[] {
  const problems: string[] = [];
  let from = 0;
  for (const needle of needles) {
    const at = text.indexOf(needle, from);
    if (at < 0) {
      problems.push(needle);
      continue;
    }
    from = at + needle.length;
  }
  return problems;
}

// Text with all whitespace removed, to compare text whose line breaks a page may
// render as separate elements.
export function squash(text: string): string {
  return text.replace(/\s+/g, "");
}

// The first family in a CSS font-family value, without quotes.
export function firstFontFamily(value: string): string {
  return (value.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
}

// Whether every duration in a computed CSS duration list, such as `0s, 0s`, is zero.
export function allZeroDurations(value: string): boolean {
  return value.split(",").every((part) => {
    const trimmed = part.trim();
    return /^-?[\d.]+m?s$/.test(trimmed) && Number.parseFloat(trimmed) === 0;
  });
}

export type LayoutShift = { value: number; startTime: number; hadRecentInput: boolean };

// Cumulative layout shift as Chromium and web-vitals define it: the largest
// session window, where a window ends after a 1 s gap or at 5 s long. Shifts
// right after input don't count.
export function cumulativeLayoutShift(shifts: readonly LayoutShift[]): number {
  let largest = 0;
  let current = 0;
  let windowStart = Number.NEGATIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const shift of shifts) {
    if (shift.hadRecentInput) continue;
    if (shift.startTime - last > 1000 || shift.startTime - windowStart > 5000) {
      current = 0;
      windowStart = shift.startTime;
    }
    current += shift.value;
    last = shift.startTime;
    largest = Math.max(largest, current);
  }
  return largest;
}

// Total blocking time: the sum of `duration − 50` over long tasks that start up
// to the load event.
export function totalBlockingTime(longTasks: readonly { startTime: number; duration: number }[], loadEventStart: number): number {
  return longTasks
    .filter((task) => task.startTime <= loadEventStart)
    .reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
}

export type TimingEntry = { name: string; duration: number; interactionId: number };

// The slowest duration of the first input: its `first-input` entry, and any
// `event` entry with the same interactionId. Null when there's no first input.
export function firstInputDuration(firstInput: TimingEntry | undefined, events: readonly TimingEntry[]): number | null {
  if (!firstInput) return null;
  const sameInteraction = firstInput.interactionId > 0 ? events.filter((e) => e.interactionId === firstInput.interactionId) : [];
  return Math.max(firstInput.duration, ...sameInteraction.map((e) => e.duration));
}

export type ConsoleEntry = { type: string; text: string; url: string };

export const NOT_FOUND_CONSOLE_TEXT = "Failed to load resource: the server responded with a status of 404";

// Console errors, apart from at most one that Chromium logs for an expected 404
// document at `allowed404Url` (Quality checks → The unknown path's own 404).
export function unexpectedConsoleErrors(entries: readonly ConsoleEntry[], allowed404Url?: string): string[] {
  const errors = entries.filter((entry) => entry.type === "error");
  const allowed = allowed404Url
    ? errors.findIndex((entry) => entry.url === allowed404Url && entry.text.startsWith(NOT_FOUND_CONSOLE_TEXT))
    : -1;
  return errors.filter((_, i) => i !== allowed).map((entry) => `${entry.url}: ${entry.text}`);
}

export type RequestOutcome = { url: string; method: string; status: number | null; error?: string; isDocument?: boolean };

// Same-origin requests that failed or got a 4xx or 5xx, apart from the expected
// 404 document at `allowed404Url`.
export function unexpectedRequestFailures(requests: readonly RequestOutcome[], origin: string, allowed404Url?: string): string[] {
  return requests
    .filter((request) => new URL(request.url).origin === origin)
    .filter((request) => request.status === null || request.status >= 400)
    .filter((request) => !(allowed404Url && request.isDocument && request.url === allowed404Url && request.status === 404))
    .map((request) => `${request.method} ${request.url}: ${request.status ?? request.error ?? "no response"}`);
}

// The same-origin links to fetch: absolute URLs without fragments, deduplicated.
// Fragment-only and mailto: links are left out (Quality checks → Internal links).
export function internalLinks(hrefs: readonly string[], pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const urls = hrefs
    .filter((href) => !href.startsWith("#") && !href.toLowerCase().startsWith("mailto:"))
    .map((href) => new URL(href, pageUrl))
    .filter((url) => url.origin === origin)
    .map((url) => {
      url.hash = "";
      return url.href;
    });
  return [...new Set(urls)];
}

export type Box = { left: number; top: number; right: number; bottom: number };

// Whether `inner` lies fully under `cover`.
export function fullyCovered(inner: Box, cover: Box): boolean {
  return inner.left >= cover.left && inner.right <= cover.right && inner.top >= cover.top && inner.bottom <= cover.bottom;
}

// Whether computed styles show a focus indicator: an outline style other than
// `none`, or a box-shadow other than `none`.
export function showsFocus(outlineStyle: string, boxShadow: string): boolean {
  return outlineStyle !== "none" || boxShadow !== "none";
}

const JAVASCRIPT_TYPES = new Set(["text/javascript", "application/javascript", "application/x-javascript", "text/ecmascript", "application/ecmascript"]);

// Whether a content-type header names JavaScript.
export function isJavaScript(contentType: string | undefined): boolean {
  return JAVASCRIPT_TYPES.has(mediaType(contentType));
}

export type MotionStyle = { element: string; transitionDuration: string; animationDuration: string };

// Elements whose computed transition or animation duration isn't zero.
export function movingElements(styles: readonly MotionStyle[]): string[] {
  return styles
    .filter((style) => !allZeroDurations(style.transitionDuration) || !allZeroDurations(style.animationDuration))
    .map((style) => `${style.element}: transition ${style.transitionDuration}, animation ${style.animationDuration}`);
}

export type FontFaceState = { family: string; display: string; status: string };

// Whether a loaded face of `family` uses `font-display: swap`. Chromium may quote
// the family name.
export function hasLoadedSwapFace(faces: readonly FontFaceState[], family: string): boolean {
  return faces.some((face) => firstFontFamily(face.family) === family && face.status === "loaded" && face.display === "swap");
}

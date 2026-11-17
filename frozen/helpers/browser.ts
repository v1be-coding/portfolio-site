// Browser and file probes for the portfolio-site acceptance tests (spec #2).
// They gather raw facts; the decisions on them are pure functions in site.ts,
// which have unit tests.
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  type Box,
  type ConsoleEntry,
  type FontFaceState,
  type LayoutShift,
  type MotionStyle,
  type RequestOutcome,
  type TimingEntry,
  fullyCovered,
  isJavaScript,
  msUntilFreshWindow,
  showsFocus,
} from "./site.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits until a fresh chat window has started, so a test's POST /api/chat calls
// don't share a window with earlier ones (spec #2, "How the frozen tests use the
// chat limit and the model").
export async function waitForFreshChatWindow(): Promise<void> {
  await sleep(msUntilFreshWindow(Date.now()));
}

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

// axe-core's violations on the page as it is now, one line per rule and target.
export async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    // options() replaces the whole option object, so it comes before withTags().
    .options({ rules: { "target-size": { enabled: true } } })
    .withTags(AXE_TAGS)
    .analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`),
  );
}

// Every console message and page error from now on. Page errors count as errors.
export function recordConsole(page: Page): ConsoleEntry[] {
  const entries: ConsoleEntry[] = [];
  page.on("console", (message) => entries.push({ type: message.type(), text: message.text(), url: message.location().url }));
  page.on("pageerror", (error) => entries.push({ type: "error", text: `page error: ${error.message}`, url: page.url() }));
  return entries;
}

// Every request's outcome from now on.
export function recordRequests(page: Page): RequestOutcome[] {
  const outcomes: RequestOutcome[] = [];
  page.on("requestfinished", async (request) => {
    const response = await request.response();
    outcomes.push({
      url: request.url(),
      method: request.method(),
      status: response?.status() ?? null,
      isDocument: request.resourceType() === "document",
    });
  });
  page.on("requestfailed", (request) => {
    outcomes.push({
      url: request.url(),
      method: request.method(),
      status: null,
      error: request.failure()?.errorText ?? "failed",
      isDocument: request.resourceType() === "document",
    });
  });
  return outcomes;
}

// Whether the focused element shows a focus indicator (spec #2, Keyboard).
export async function focusIsVisible(page: Page): Promise<boolean> {
  const style = await page.evaluate(() => {
    const element = document.activeElement;
    const computed = element ? getComputedStyle(element) : null;
    return { outlineStyle: computed?.outlineStyle ?? "none", boxShadow: computed?.boxShadow ?? "none" };
  });
  return showsFocus(style.outlineStyle, style.boxShadow);
}

export type TabWalk = { stops: number; reachedChatTab: boolean; covered: string[] };

// Presses Tab from the current focus until the Chat tab is focused, or `maxStops`
// presses. Reports each stop whose element lay fully under the Chat tab.
export async function tabToChatTab(page: Page, chatTab: Locator, maxStops = 300): Promise<TabWalk> {
  const covered: string[] = [];
  for (let stops = 1; stops <= maxStops; stops++) {
    await page.keyboard.press("Tab");
    if (await chatTab.evaluate((element) => element === document.activeElement)) {
      return { stops, reachedChatTab: true, covered };
    }
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      const rect = element?.getBoundingClientRect();
      return {
        description: `${element?.tagName.toLowerCase()} "${(element?.textContent ?? "").trim().slice(0, 40)}"`,
        box: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
      };
    });
    const tab = await chatTab.boundingBox();
    const tabBox: Box | null = tab ? { left: tab.x, top: tab.y, right: tab.x + tab.width, bottom: tab.y + tab.height } : null;
    if (focused.box && tabBox && fullyCovered(focused.box, tabBox)) covered.push(focused.description);
  }
  return { stops: maxStops, reachedChatTab: false, covered };
}

// Records layout shifts, LCP candidates and long tasks from the first byte. Call
// before page.goto.
export async function installPerformanceProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store = {
      shifts: [] as { value: number; startTime: number; hadRecentInput: boolean }[],
      lcp: [] as number[],
      longTasks: [] as { startTime: number; duration: number }[],
    };
    (window as unknown as { __perfProbe: typeof store }).__perfProbe = store;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        store.shifts.push({ value: shift.value, startTime: shift.startTime, hadRecentInput: shift.hadRecentInput });
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.lcp.push(entry.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    }).observe({ type: "longtask", buffered: true });
  });
}

export type PerformanceReading = {
  shifts: LayoutShift[];
  lcp: number[];
  longTasks: { startTime: number; duration: number }[];
  loadEventStart: number;
};

// What the probe has recorded so far, and when the load event started.
export async function readPerformance(page: Page): Promise<PerformanceReading> {
  return page.evaluate(() => {
    const store = (window as unknown as { __perfProbe: Omit<PerformanceReading, "loadEventStart"> }).__perfProbe;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return { ...store, loadEventStart: navigation?.loadEventStart ?? 0 };
  });
}

// The `first-input` entry and the `event` entries (from 16 ms), read with a
// buffered PerformanceObserver, as spec #2's Performance check says.
export async function readEventTiming(page: Page): Promise<{ firstInput: TimingEntry | undefined; events: TimingEntry[] }> {
  return page.evaluate(
    () =>
      new Promise<{ firstInput: TimingEntry | undefined; events: TimingEntry[] }>((resolve) => {
        const toEntry = (entry: PerformanceEntry) => ({
          name: entry.name,
          duration: entry.duration,
          interactionId: (entry as PerformanceEventTiming).interactionId ?? 0,
        });
        const firstInputs: TimingEntry[] = [];
        const events: TimingEntry[] = [];
        new PerformanceObserver((list) => firstInputs.push(...list.getEntries().map(toEntry))).observe({
          type: "first-input",
          buffered: true,
        });
        new PerformanceObserver((list) => events.push(...list.getEntries().map(toEntry))).observe({
          type: "event",
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
        setTimeout(() => resolve({ firstInput: firstInputs[0], events }), 1000);
      }),
  );
}

// Sums the encoded body bytes of same-origin JavaScript responses from now on.
export function recordScriptBytes(page: Page, origin: string): () => Promise<number> {
  const sizes: Promise<number>[] = [];
  page.on("requestfinished", (request) => {
    sizes.push(
      (async () => {
        const response = await request.response();
        if (!response || new URL(request.url()).origin !== origin) return 0;
        if (!isJavaScript(response.headers()["content-type"])) return 0;
        return (await request.sizes()).responseBodySize;
      })(),
    );
  });
  return async () => (await Promise.all(sizes)).reduce((sum, size) => sum + size, 0);
}

// Every element's computed transition and animation durations.
export async function motionStyles(page: Page): Promise<MotionStyle[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("*")].map((element) => {
      const style = getComputedStyle(element);
      const id = element.id ? `#${element.id}` : "";
      const classes = typeof element.className === "string" && element.className ? `.${element.className.trim().split(/\s+/).join(".")}` : "";
      return {
        element: `${element.tagName.toLowerCase()}${id}${classes}`,
        transitionDuration: style.transitionDuration,
        animationDuration: style.animationDuration,
      };
    }),
  );
}

// The page's font faces, once document.fonts is ready, and body's font-family.
export async function fontState(page: Page): Promise<{ faces: FontFaceState[]; bodyFontFamily: string }> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return {
      faces: [...document.fonts].map((face) => ({ family: face.family, display: face.display, status: face.status })),
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
    };
  });
}

// Whether the document has scrolled sideways past its width.
export async function overflowsSideways(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

export type PdfPage = { width: number; height: number; text: string };

// Each page's size in points and its text, read with pdfjs-dist.
export async function readPdf(bytes: Buffer): Promise<PdfPage[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const document = await loading.promise;
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push({ width, height, text });
  }
  await loading.destroy();
  return pages;
}

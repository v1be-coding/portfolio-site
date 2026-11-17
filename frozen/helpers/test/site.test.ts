// Run with: npm run test:helpers
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allZeroDurations,
  cumulativeLayoutShift,
  firstFontFamily,
  firstInputDuration,
  fullyCovered,
  hasLoadedSwapFace,
  internalLinks,
  isJavaScript,
  mediaType,
  movingElements,
  msUntilFreshWindow,
  NOT_FOUND_CONSOLE_TEXT,
  orderProblems,
  showsFocus,
  squash,
  totalBlockingTime,
  unexpectedConsoleErrors,
  unexpectedRequestFailures,
} from "../site.ts";

describe("mediaType", () => {
  it("drops parameters and case", () => {
    assert.equal(mediaType("Application/JSON; charset=utf-8"), "application/json");
    assert.equal(mediaType("image/png"), "image/png");
  });
  it("is empty for a missing header", () => {
    assert.equal(mediaType(undefined), "");
  });
});

describe("isJavaScript", () => {
  it("accepts JavaScript media types, with parameters", () => {
    assert.equal(isJavaScript("text/javascript; charset=utf-8"), true);
    assert.equal(isJavaScript("application/javascript"), true);
  });
  it("rejects others", () => {
    assert.equal(isJavaScript("text/css"), false);
    assert.equal(isJavaScript(undefined), false);
  });
});

describe("msUntilFreshWindow", () => {
  it("waits for the next boundary plus the margin", () => {
    assert.equal(msUntilFreshWindow(120_000 + 15_000, 60_000, 2_000), 47_000);
  });
  it("never uses the current window, even right after a boundary", () => {
    assert.equal(msUntilFreshWindow(120_000 + 500, 60_000, 2_000), 61_500);
    assert.equal(msUntilFreshWindow(120_000, 60_000, 2_000), 62_000);
  });
});

describe("orderProblems", () => {
  it("is empty when every needle appears in order", () => {
    assert.deepEqual(orderProblems("a b c a", ["a", "b", "c", "a"]), []);
  });
  it("reports a needle that appears only earlier", () => {
    assert.deepEqual(orderProblems("b a", ["a", "b"]), ["b"]);
  });
  it("reports a missing needle and keeps checking the rest", () => {
    assert.deepEqual(orderProblems("a c", ["a", "b", "c"]), ["b"]);
  });
});

describe("squash", () => {
  it("removes all whitespace", () => {
    assert.equal(squash(" Mar 2023\n– Present "), "Mar2023–Present");
  });
});

describe("firstFontFamily", () => {
  it("takes the first family without quotes", () => {
    assert.equal(firstFontFamily('"Atkinson Hyperlegible Next", system-ui, sans-serif'), "Atkinson Hyperlegible Next");
    assert.equal(firstFontFamily("system-ui"), "system-ui");
  });
});

describe("allZeroDurations", () => {
  it("accepts zero and lists of zero", () => {
    assert.equal(allZeroDurations("0s"), true);
    assert.equal(allZeroDurations("0s, 0s"), true);
  });
  it("rejects any non-zero value", () => {
    assert.equal(allZeroDurations("0.15s"), false);
    assert.equal(allZeroDurations("0s, 0.15s"), false);
    assert.equal(allZeroDurations("1e-05s"), false);
  });
});

describe("movingElements", () => {
  it("lists only elements with a non-zero duration", () => {
    const moving = movingElements([
      { element: "a", transitionDuration: "0s", animationDuration: "0s" },
      { element: "b", transitionDuration: "0s, 0.15s", animationDuration: "0s" },
      { element: "c", transitionDuration: "0s", animationDuration: "1s" },
    ]);
    assert.deepEqual(moving, ["b: transition 0s, 0.15s, animation 0s", "c: transition 0s, animation 1s"]);
  });
});

describe("hasLoadedSwapFace", () => {
  const face = { family: '"Atkinson Hyperlegible Next"', display: "swap", status: "loaded" };
  it("finds a loaded swap face, quoted or not", () => {
    assert.equal(hasLoadedSwapFace([face], "Atkinson Hyperlegible Next"), true);
    assert.equal(hasLoadedSwapFace([{ ...face, family: "Atkinson Hyperlegible Next" }], "Atkinson Hyperlegible Next"), true);
  });
  it("needs it loaded and swap", () => {
    assert.equal(hasLoadedSwapFace([{ ...face, status: "unloaded" }], "Atkinson Hyperlegible Next"), false);
    assert.equal(hasLoadedSwapFace([{ ...face, display: "auto" }], "Atkinson Hyperlegible Next"), false);
    assert.equal(hasLoadedSwapFace([face], "Other"), false);
  });
});

describe("cumulativeLayoutShift", () => {
  const shift = (startTime: number, value: number, hadRecentInput = false) => ({ startTime, value, hadRecentInput });
  it("is 0 with no shifts", () => {
    assert.equal(cumulativeLayoutShift([]), 0);
  });
  it("sums shifts within one session window", () => {
    assert.equal(cumulativeLayoutShift([shift(100, 0.05), shift(600, 0.03)]), 0.08);
  });
  it("takes the largest window after a gap over 1 s", () => {
    assert.equal(cumulativeLayoutShift([shift(100, 0.05), shift(1200, 0.02), shift(1300, 0.01)]), 0.05);
  });
  it("ends a window at 5 s long", () => {
    const steady = [0, 900, 1800, 2700, 3600, 4500, 5400].map((t) => shift(t, 0.01));
    assert.equal(Math.round(cumulativeLayoutShift(steady) * 100) / 100, 0.06);
  });
  it("ignores shifts right after input", () => {
    assert.equal(cumulativeLayoutShift([shift(100, 0.5, true), shift(200, 0.01)]), 0.01);
  });
});

describe("totalBlockingTime", () => {
  it("sums the time over 50 ms of tasks up to the load event", () => {
    const tasks = [
      { startTime: 10, duration: 120 },
      { startTime: 300, duration: 60 },
      { startTime: 900, duration: 500 },
    ];
    assert.equal(totalBlockingTime(tasks, 800), 80);
  });
});

describe("firstInputDuration", () => {
  const first = { name: "pointerdown", duration: 24, interactionId: 7 };
  it("is null without a first input", () => {
    assert.equal(firstInputDuration(undefined, []), null);
  });
  it("is the first input's duration when no event entry is longer", () => {
    assert.equal(firstInputDuration(first, []), 24);
  });
  it("takes the slowest event of the same interaction only", () => {
    const events = [
      { name: "click", duration: 180, interactionId: 7 },
      { name: "keydown", duration: 400, interactionId: 9 },
    ];
    assert.equal(firstInputDuration(first, events), 180);
  });
  it("matches no events when the first input has no interactionId", () => {
    assert.equal(firstInputDuration({ ...first, interactionId: 0 }, [{ name: "x", duration: 300, interactionId: 0 }]), 24);
  });
});

describe("unexpectedConsoleErrors", () => {
  const url = "https://site.test/no-such-page";
  const notFound = { type: "error", text: `${NOT_FOUND_CONSOLE_TEXT} ()`, url };
  it("ignores messages that aren't errors", () => {
    assert.deepEqual(unexpectedConsoleErrors([{ type: "warning", text: "w", url }]), []);
  });
  it("reports every error when no 404 is expected", () => {
    assert.deepEqual(unexpectedConsoleErrors([notFound]), [`${url}: ${notFound.text}`]);
  });
  it("allows exactly one 404 message for the expected URL", () => {
    assert.deepEqual(unexpectedConsoleErrors([notFound], url), []);
    assert.deepEqual(unexpectedConsoleErrors([notFound, notFound], url), [`${url}: ${notFound.text}`]);
  });
  it("still reports a 404 message for another URL, or another error", () => {
    const other = { type: "error", text: `${NOT_FOUND_CONSOLE_TEXT} ()`, url: "https://site.test/app.js" };
    const thrown = { type: "error", text: "boom", url };
    assert.deepEqual(unexpectedConsoleErrors([other, thrown], url), [`${other.url}: ${other.text}`, `${url}: boom`]);
  });
});

describe("unexpectedRequestFailures", () => {
  const origin = "https://site.test";
  it("reports same-origin failures and 4xx or 5xx responses", () => {
    const failures = unexpectedRequestFailures(
      [
        { url: `${origin}/a.js`, method: "GET", status: 200 },
        { url: `${origin}/api/health`, method: "GET", status: 500 },
        { url: `${origin}/b.css`, method: "GET", status: null, error: "net::ERR_FAILED" },
        { url: "https://other.test/x", method: "GET", status: 404 },
      ],
      origin,
    );
    assert.deepEqual(failures, [`GET ${origin}/api/health: 500`, `GET ${origin}/b.css: net::ERR_FAILED`]);
  });
  it("allows the expected 404 document only", () => {
    const url = `${origin}/no-such-page`;
    const failures = unexpectedRequestFailures(
      [
        { url, method: "GET", status: 404, isDocument: true },
        { url: `${origin}/x.js`, method: "GET", status: 404 },
      ],
      origin,
      url,
    );
    assert.deepEqual(failures, [`GET ${origin}/x.js: 404`]);
  });
});

describe("internalLinks", () => {
  it("keeps same-origin links, without fragments, once each", () => {
    const links = internalLinks(
      ["/", "#about", "mailto:a@b.c", "MAILTO:a@b.c", "/v1be-coding#top", "/v1be-coding", "https://github.com/x", "https://site.test/resume.pdf"],
      "https://site.test/page",
    );
    assert.deepEqual(links, ["https://site.test/", "https://site.test/v1be-coding", "https://site.test/resume.pdf"]);
  });
});

describe("fullyCovered", () => {
  const cover = { left: 100, top: 100, right: 200, bottom: 150 };
  it("is true only when the box lies inside the cover", () => {
    assert.equal(fullyCovered({ left: 110, top: 110, right: 190, bottom: 140 }, cover), true);
    assert.equal(fullyCovered({ left: 90, top: 110, right: 190, bottom: 140 }, cover), false);
    assert.equal(fullyCovered({ left: 110, top: 110, right: 190, bottom: 160 }, cover), false);
  });
});

describe("showsFocus", () => {
  it("accepts an outline or a box-shadow", () => {
    assert.equal(showsFocus("solid", "none"), true);
    assert.equal(showsFocus("none", "rgb(0, 0, 0) 0px 0px 0px 2px"), true);
    assert.equal(showsFocus("auto", "none"), true);
  });
  it("rejects neither", () => {
    assert.equal(showsFocus("none", "none"), false);
  });
});

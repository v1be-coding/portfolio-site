// The Series and Episode pages render from the content module, so a finished
// episode must show its results without a page change. The frozen tests cover
// Episode 0 as it ships (everything null); these cover the filled-in states.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { content, type Episode } from "../../content/content.js";
import { EpisodePage } from "./EpisodePage.js";
import { SeriesPage } from "./SeriesPage.js";

const finished: Episode = {
  number: 1,
  slug: "finished-app",
  title: "Finished app",
  summary: "An app whose episode has ended.",
  description: "What the app is.",
  shareDescription: "Share text.",
  links: {
    live: "https://example.com",
    repository: "https://github.com/v1be-coding/finished-app",
    specIssue: "https://github.com/v1be-coding/finished-app/issues/1",
  },
  scorecard: {
    timeToGreen: "3h 10m",
    attempts: 2,
    testsPassingOnAttempt1: "41 of 64",
    buildCost: "$18.40",
    model: "Claude Opus 5.5",
    specMissed: "The 404 copy.",
    frozenTestsWrong: "None.",
  },
  demo: { src: "/demo.png", alt: "The app's home page", width: 1280, height: 720 },
  howItWorks: "The app streams replies.",
  retro: "The spec should have pinned the error copy.",
};

const placeholder = "Added after the episode.";

function count(html: string, text: string): number {
  return html.split(text).length - 1;
}

describe("SeriesPage", () => {
  test("says an Episode without a Scorecard is in progress", () => {
    const html = renderToStaticMarkup(<SeriesPage />);
    expect(html).toContain("Scorecard: in progress");
  });
});

describe("EpisodePage", () => {
  test("shows the placeholders while the episode runs", () => {
    const html = renderToStaticMarkup(<EpisodePage episode={content.episodes[0]} />);
    expect(count(html, placeholder)).toBe(3);
    expect(html).toContain("In progress. The Scorecard is added when the episode ends.");
  });

  test("shows a finished episode's results instead of the placeholders", () => {
    const html = renderToStaticMarkup(<EpisodePage episode={finished} />);
    expect(count(html, placeholder)).toBe(0);
    expect(html).not.toContain("In progress.");
    expect(html).toContain("Episode 1");
    expect(html).toContain("3h 10m");
    expect(html).toContain("41 of 64");
    expect(html).toContain("$18.40");
    expect(html).toContain("The 404 copy.");
    expect(html).toContain("The app streams replies.");
    expect(html).toContain("The spec should have pinned the error copy.");
    expect(html).toMatch(
      /<img[^>]*src="\/demo.png"[^>]*alt="The app&#x27;s home page"[^>]*width="1280"[^>]*height="720"/,
    );
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage.js";

const html = renderToStaticMarkup(<HomePage />);

function text(fragment: string): string {
  // Inline tags and React's text separators join text; block tags break it.
  return fragment
    .replace(/<!-- -->|<\/?a\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function section(id: string): string {
  const match = new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(html);
  expect(match, `section#${id}`).not.toBeNull();
  return match?.[0] ?? "";
}

function tagTexts(fragment: string, tag: string): string[] {
  return [...fragment.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) =>
    text(m[1] ?? ""),
  );
}

// Expected values are the spec's (#2, Page: home and Content), not read from content.ts.
describe("HomePage", () => {
  it("has the four sections, in order, each with its h2", () => {
    expect([...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "about",
      "experience",
      "skills",
      "education",
    ]);
    expect(tagTexts(html, "h2")).toEqual(["About", "Experience", "Skills", "Education"]);
  });

  it("links Episode 0 from the About sentence", () => {
    const about = section("about");
    expect(text(about)).toContain(
      "Senior full-stack engineer (TypeScript, Node.js, React/Vue/Svelte)",
    );
    expect(text(about)).toContain(
      "This site is Episode 0 of V1be Coding, a series where each app goes from a written spec to a deployed site in one AI agent run.",
    );
    expect(about).toMatch(
      /<a href="\/v1be-coding\/portfolio-site"[^>]*>Episode 0 of V1be Coding<\/a>/,
    );
  });

  it("lists each role as an article, newest first, with its Engagements as h4s", () => {
    const experience = section("experience");
    const articles = [...experience.matchAll(/<article[\s\S]*?<\/article>/g)].map((m) => m[0]);
    expect(articles.map((a) => tagTexts(a, "h3"))).toEqual([
      ["Senior Software Engineer / Lead Developer, Prostrive (Remote)"],
      ["Software Engineer (Full Stack), WebMD (Remote)"],
    ]);
    expect(tagTexts(articles[0] ?? "", "h4")).toEqual([
      "White-label online banking platform",
      "Real-time multiplayer streaming platform",
      "Video-based hiring platform, Team Lead",
      "Real-money gaming platform",
    ]);
    const prostrive = text(articles[0] ?? "");
    expect(prostrive.indexOf("Mar 2023 – Present")).toBeLessThan(prostrive.indexOf("White-label"));
    expect(prostrive).toContain(
      "Real-money gaming platform May 2023 – Jun 2024 Built a microservices backend with real-time gameplay",
    );
    expect(text(articles[1] ?? "")).toContain(
      "Mar 2021 – Mar 2023 Migrated legacy jQuery to Vue 2",
    );
  });

  it("shows each Skills group label followed by its plain list", () => {
    const skills = text(section("skills"));
    expect(skills).toContain("Frontend React, Next.js, Vue, SvelteKit, Tailwind CSS");
    expect(skills).toContain("Testing Jest, Vitest, Playwright, Cypress");
  });

  it("shows the Education line", () => {
    expect(text(section("education"))).toContain(
      "BS Mechanical Engineering, Saint Louis University, 2020",
    );
  });
});

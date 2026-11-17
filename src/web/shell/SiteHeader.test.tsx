import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { routeFor } from "../routes.js";
import { SiteHeader } from "./SiteHeader.js";

function render(path: string): string {
  return renderToStaticMarkup(<SiteHeader route={routeFor(path)} />);
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1] ?? "");
}

function currentHrefs(html: string): string[] {
  return [...html.matchAll(/<a [^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes('aria-current="page"'))
    .map((tag) => /href="([^"]*)"/.exec(tag)?.[1] ?? "");
}

// Expected values are the spec's (#2, C20–C22, C28), not read from content.ts.
describe("SiteHeader", () => {
  it("on /, puts the links in the spec's tab order with Home current", () => {
    const html = render("/");
    expect(html).toContain("<h1");
    expect(hrefs(html)).toEqual([
      "/",
      "/v1be-coding",
      "#about",
      "#experience",
      "#skills",
      "#education",
      "https://github.com/emilianocasijr",
      "https://www.linkedin.com/in/emiliano-casi-jr",
      "mailto:casi.emilianojr@gmail.com",
      "/resume.pdf",
    ]);
    expect(currentHrefs(html)).toEqual(["/"]);
    expect(html).toContain('aria-label="Site"');
    expect(html).toContain('aria-label="On this page"');
    expect(html).toMatch(/<a [^>]*href="\/resume.pdf"[^>]*download/);
  });

  it("on /v1be-coding, links the name home, marks V1be Coding current and drops the section links", () => {
    const html = render("/v1be-coding");
    expect(html).not.toContain("<h1");
    expect(hrefs(html).slice(0, 3)).toEqual(["/", "/", "/v1be-coding"]);
    expect(currentHrefs(html)).toEqual(["/v1be-coding"]);
    expect(html).not.toContain("On this page");
  });

  it("on an Episode page and the 404, marks no Site link current", () => {
    expect(currentHrefs(render("/v1be-coding/portfolio-site"))).toEqual([]);
    expect(currentHrefs(render("/no-such-page"))).toEqual([]);
  });
});

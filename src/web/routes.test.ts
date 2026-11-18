import { describe, expect, it } from "vitest";
import { PAGE_PATHS, headFor, routeFor } from "./routes.js";

describe("routeFor", () => {
  it.each([
    ["/", "home"],
    ["/v1be-coding", "series"],
    ["/v1be-coding/", "series"],
    ["/v1be-coding/portfolio-site", "episode"],
    ["/v1be-coding/portfolio-site/", "episode"],
    ["/v1be-coding/index.html", "series"],
    ["/index.html", "home"],
    ["/no-such-page-1234", "notFound"],
    ["/v1be-coding/no-such-episode-1234", "notFound"],
    ["/404.html", "notFound"],
  ])("%s is the %s page", (path, page) => {
    expect(routeFor(path).page).toBe(page);
  });

  it("finds the Episode for an Episode path", () => {
    const route = routeFor("/v1be-coding/portfolio-site");
    expect(route.page === "episode" && route.episode.title).toBe("Portfolio site");
  });
});

describe("PAGE_PATHS", () => {
  it("lists the three real pages, which are what the sitemap and prerender use", () => {
    expect(PAGE_PATHS).toEqual(["/", "/v1be-coding", "/v1be-coding/portfolio-site"]);
  });
});

describe("headFor", () => {
  it("gives each real page its title, description and canonical URL", () => {
    expect(PAGE_PATHS.map((path) => headFor(routeFor(path)))).toEqual([
      {
        title: "Emiliano Casi Jr",
        description:
          "Emiliano Casi Jr is a senior full-stack engineer building fintech and AI-first products, working remotely from the Philippines.",
        canonical: "https://emilianocasijr.com/",
      },
      {
        title: "V1be Coding · Emiliano Casi Jr",
        description:
          "V1be Coding is a build series where each app goes from a written spec to a deployed site in one AI agent run.",
        canonical: "https://emilianocasijr.com/v1be-coding",
      },
      {
        title: "Portfolio site · V1be Coding",
        description:
          "Episode 0 of V1be Coding: Emiliano Casi Jr's portfolio site, with an AI chat that answers from the site's own content.",
        canonical: "https://emilianocasijr.com/v1be-coding/portfolio-site",
      },
    ]);
  });

  it("gives the 404 page no canonical URL", () => {
    expect(headFor(routeFor("/nope"))).toEqual({
      title: "Page not found",
      description: "The page you asked for doesn't exist.",
      canonical: null,
    });
  });
});

// The site's path map: which page a URL path shows, and that page's head
// metadata. Shared by the prerender and the browser, so both resolve the same
// route for the same file (react-prerender-hydration.md, R4).
import { content, episodePath, type Episode } from "../content/content.js";

export type Route =
  | { page: "home"; path: "/" }
  | { page: "series"; path: "/v1be-coding" }
  | { page: "episode"; path: string; episode: Episode }
  | { page: "notFound"; path: null };

export type PageName = Route["page"];

export type Head = { title: string; description: string; canonical: string | null };

const SERIES_PATH = "/v1be-coding";

/** The real pages' canonical paths, in sitemap order. */
export const PAGE_PATHS: readonly string[] = [
  "/",
  SERIES_PATH,
  ...content.episodes.map(episodePath),
];

export const NOT_FOUND: Route = { page: "notFound", path: null };

// CloudFront serves /path/index.html at /path and 301s a trailing slash, but a
// visitor can still land on either spelling, so both resolve to the canonical
// route instead of the 404 tree.
function canonicalPath(pathname: string): string {
  const path = pathname.replace(/\/index\.html$/, "/");
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function routeFor(pathname: string): Route {
  const path = canonicalPath(pathname);
  if (path === "/") return { page: "home", path: "/" };
  if (path === SERIES_PATH) return { page: "series", path: SERIES_PATH };
  const episode = content.episodes.find((e) => episodePath(e) === path);
  return episode ? { page: "episode", path, episode } : NOT_FOUND;
}

export function headFor(route: Route): Head {
  const { name } = content.profile;
  const canonical = route.path === null ? null : `${content.profile.site}${route.path}`;
  switch (route.page) {
    case "home":
      return {
        title: name,
        description: `${name} is a senior full-stack engineer building fintech and AI-first products, working remotely from the Philippines.`,
        canonical,
      };
    case "series":
      return {
        title: `V1be Coding · ${name}`,
        description:
          "V1be Coding is a build series where each app goes from a written spec to a deployed site in one AI agent run.",
        canonical,
      };
    case "episode":
      return {
        title: `${route.episode.title} · V1be Coding`,
        description: route.episode.shareDescription,
        canonical,
      };
    case "notFound":
      return {
        title: "Page not found",
        description: "The page you asked for doesn't exist.",
        canonical: null,
      };
  }
}

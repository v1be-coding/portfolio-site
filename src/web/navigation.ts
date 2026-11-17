// Moves between the site's pages in the browser: an internal <a href> click is
// handled through the History API, and back and forward re-render the route for
// the new URL. No router library: the path map in routes.ts is the whole table.
import { useEffect, useState } from "react";
import { routeFor, type Route } from "./routes.js";

export type Navigation = {
  route: Route;
  /** How the current route was reached: on load, by a link, or by back/forward. */
  via: "load" | "link" | "history";
};

// The URL a click should navigate to in place, or null to leave the click to the
// browser: modified clicks, downloads, other windows, other origins, files such
// as /resume.pdf, and jumps within the current page.
function inPlaceTarget(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (!(event.target instanceof Element)) return null;
  const anchor = event.target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.target !== "" && anchor.target !== "_self") return null;
  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return null;
  if (routeFor(url.pathname).page === "notFound") return null;
  if (url.pathname === window.location.pathname && url.hash !== "") return null;
  return url;
}

export function useNavigation(initial: Route): Navigation {
  const [navigation, setNavigation] = useState<Navigation>({ route: initial, via: "load" });

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const url = inPlaceTarget(event);
      if (!url) return;
      event.preventDefault();
      if (url.href !== window.location.href) window.history.pushState(null, "", url);
      setNavigation({ route: routeFor(url.pathname), via: "link" });
    }
    function onPopState() {
      setNavigation({ route: routeFor(window.location.pathname), via: "history" });
    }
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return navigation;
}

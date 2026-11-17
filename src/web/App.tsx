import { StrictMode, useEffect } from "react";
import { applyHead } from "./head.js";
import { useNavigation } from "./navigation.js";
import { EpisodePage } from "./pages/EpisodePage.js";
import { HomePage } from "./pages/HomePage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { SeriesPage } from "./pages/SeriesPage.js";
import { headFor, type Route } from "./routes.js";
import { MAIN_ID, Shell } from "./shell/Shell.js";
import "./styles/global.css";

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "home":
      return <HomePage />;
    case "series":
      return <SeriesPage />;
    case "episode":
      return <EpisodePage episode={route.episode} />;
    case "notFound":
      return <NotFoundPage />;
  }
}

// A malformed escape like "#%E0" makes decodeURIComponent throw, and a throw in
// the effect is a page error; the raw text still matches no id, so the page
// scrolls to the top instead.
function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function App({ initialRoute }: { initialRoute: Route }) {
  const navigation = useNavigation(initialRoute);

  useEffect(() => {
    // On load the prerendered head is already right.
    if (navigation.via === "load") return;
    applyHead(headFor(navigation.route));
    // Back and forward leave scrolling to the browser's own restoration.
    if (navigation.via !== "link") return;
    const hash = decodeHash(window.location.hash.slice(1));
    const target = hash ? document.getElementById(hash) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    // Keyboard and screen reader users carry on from the new page, not the old link.
    document.getElementById(MAIN_ID)?.focus({ preventScroll: true });
  }, [navigation]);

  return (
    <Shell route={navigation.route}>
      <Page route={navigation.route} />
    </Shell>
  );
}

// The one tree both the prerender and hydrateRoot render, so their wrappers can't
// differ (react-prerender-hydration.md, R4 and R12).
export function Root({ initialRoute }: { initialRoute: Route }) {
  return (
    <StrictMode>
      <App initialRoute={initialRoute} />
    </StrictMode>
  );
}

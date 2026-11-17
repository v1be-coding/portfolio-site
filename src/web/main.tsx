import { createRoot, hydrateRoot } from "react-dom/client";
import { Root } from "./App.js";
import { routeFor } from "./routes.js";

const container = document.getElementById("root")!;

// The prerender records which route it rendered into this file, and the first
// client render must use the same one. The URL alone can't say: the 404 page is
// served at any unknown path, and the host may add or drop a trailing slash.
const renderedPath = container.dataset.path;
const route = routeFor(renderedPath?.startsWith("/") ? renderedPath : window.location.pathname);

// `vite dev` serves the bare template, with nothing to hydrate.
if (container.hasChildNodes()) hydrateRoot(container, <Root initialRoute={route} />);
else createRoot(container).render(<Root initialRoute={route} />);

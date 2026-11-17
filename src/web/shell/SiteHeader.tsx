import { content } from "../../content/content.js";
import type { Route } from "../routes.js";

// The shell's left column. On / the name is the page's one h1; elsewhere it links
// home and the page's own h1 sits in <main>.
export function SiteHeader({ route }: { route: Route }) {
  const { name, tagline, availability } = content.profile;
  return (
    <header className="site-header">
      {route.page === "home" ? (
        <h1 className="site-name">{name}</h1>
      ) : (
        <p className="site-name">
          <a href="/">{name}</a>
        </p>
      )}
      <p className="site-tagline">{tagline}</p>
      <p className="site-availability">{availability}</p>
    </header>
  );
}

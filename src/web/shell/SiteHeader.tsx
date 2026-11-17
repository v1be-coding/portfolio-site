import { content } from "../../content/content.js";
import type { Route } from "../routes.js";

const SITE_LINKS = [
  { label: "Home", href: "/", page: "home" },
  { label: "V1be Coding", href: "/v1be-coding", page: "series" },
] as const;

// The ids the home page gives its sections.
const SECTION_LINKS = [
  { label: "About", id: "about" },
  { label: "Experience", id: "experience" },
  { label: "Skills", id: "skills" },
  { label: "Education", id: "education" },
] as const;

// The shell's left column. Its DOM order is the spec's tab order (C28): Site nav,
// then "On this page", then the contact links. The current page comes from the
// route prop, never from `location`, so the build and hydration agree.
// On / the name is the page's one h1; elsewhere it links home and the page's own
// h1 sits in <main>.
export function SiteHeader({ route }: { route: Route }) {
  const { name, tagline, availability, github, linkedin, email } = content.profile;
  const isHome = route.page === "home";
  return (
    <header className="site-header">
      <div className="site-intro">
        {isHome ? (
          <h1 className="site-name">{name}</h1>
        ) : (
          <p className="site-name">
            <a href="/">{name}</a>
          </p>
        )}
        <p className="site-tagline">{tagline}</p>
        <p className="site-availability">{availability}</p>
        <nav aria-label="Site" className="site-nav">
          <ul>
            {SITE_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} aria-current={route.page === link.page ? "page" : undefined}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {isHome && (
        <nav aria-label="On this page" className="section-nav">
          <ul>
            {SECTION_LINKS.map((link) => (
              <li key={link.id}>
                <a href={`#${link.id}`}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <ul className="site-contact">
        <li>
          <a href={github}>GitHub</a>
        </li>
        <li>
          <a href={linkedin}>LinkedIn</a>
        </li>
        <li>
          <a href={`mailto:${email}`}>Email me</a>
        </li>
        <li>
          <a className="site-resume" href="/resume.pdf" download>
            Download resume
          </a>
        </li>
      </ul>
    </header>
  );
}

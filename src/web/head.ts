// A page's per-route <head> tags. The prerender writes them into each HTML file
// (so crawlers and link previews see them without JavaScript), and client-side
// navigation swaps them in place, from the same list.
import { content } from "../content/content.js";
import type { Head } from "./routes.js";

type HeadTag = { tag: "meta" | "link"; attributes: Record<string, string> };

// Marks the tags that change per page, so navigation replaces only those and
// leaves Vite's stylesheet and script links alone.
const MARKER = "data-route-head";

function headTags(head: Head): HeadTag[] {
  const meta = (attributes: Record<string, string>): HeadTag => ({ tag: "meta", attributes });
  const tags = [meta({ name: "description", content: head.description })];
  if (head.canonical === null) {
    // Only the 404 page lacks a canonical URL, and it must stay out of search results.
    return [...tags, meta({ name: "robots", content: "noindex" })];
  }
  return [
    ...tags,
    { tag: "link", attributes: { rel: "canonical", href: head.canonical } },
    meta({ property: "og:type", content: "website" }),
    meta({ property: "og:url", content: head.canonical }),
    meta({ property: "og:title", content: head.title }),
    meta({ property: "og:description", content: head.description }),
    meta({ property: "og:image", content: `${content.profile.site}/og.png` }),
  ];
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** The <title> and per-route tags as HTML, for the prerender. */
export function headHtml(head: Head): string {
  const tags = headTags(head).map(({ tag, attributes }) => {
    const attrs = Object.entries(attributes)
      .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
      .join("");
    return `<${tag}${attrs} ${MARKER}>`;
  });
  return [`<title>${escapeHtml(head.title)}</title>`, ...tags].join("\n    ");
}

/** Replaces the document's title and per-route tags. Browser only. */
export function applyHead(head: Head): void {
  document.title = head.title;
  for (const element of document.head.querySelectorAll(`[${MARKER}]`)) element.remove();
  for (const { tag, attributes } of headTags(head)) {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    element.setAttribute(MARKER, "");
    document.head.append(element);
  }
}

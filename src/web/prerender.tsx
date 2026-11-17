// Writes each page to its own HTML file after `vite build`, using the client
// build's index.html as the template, so the asset links are the hashed ones.
// Run from the SSR build: `node dist/prerender/prerender.js dist/web`.
//
// The host serves /path from /path/index.html and every unknown path from
// /404.html with status 404, so the files are named to match.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { prerender } from "react-dom/static";
import { Root } from "./App.js";
import { headHtml } from "./head.js";
import { NOT_FOUND, PAGE_PATHS, headFor, routeFor, type Route } from "./routes.js";

const outDir = process.argv[2];
if (!outDir) throw new Error("Usage: node prerender.js <client build dir>");

// prerender waits for anything that suspends, which renderToString wouldn't
// (react-prerender-hydration.md, R11).
async function renderApp(route: Route): Promise<string> {
  const { prelude } = await prerender(<Root initialRoute={route} />);
  return new Response(prelude).text();
}

// Preloading the font files lets text render in its own face on first paint
// instead of swapping, which would shift the layout.
async function fontPreloads(): Promise<string[]> {
  const assets = await readdir(join(outDir, "assets"));
  return assets
    .filter((file) => file.endsWith(".woff2"))
    .sort()
    .map(
      (file) =>
        `<link rel="preload" href="/assets/${file}" as="font" type="font/woff2" crossorigin>`,
    );
}

function fill(template: string, placeholder: string, value: string): string {
  if (template.split(placeholder).length !== 2) {
    throw new Error(`The template must hold ${placeholder} exactly once`);
  }
  return template.replace(placeholder, () => value);
}

// The CSP allows no inline script or style (spec #2, Headers), and a page that
// breaks it fails in the browser with only a console error, so fail the build.
function assertCspSafe(file: string, html: string): void {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error(`${file} has an inline <script>`);
  if (/<style[\s>]/i.test(html)) throw new Error(`${file} has a <style> element`);
  if (/\sstyle=/i.test(html)) throw new Error(`${file} has a style attribute`);
}

function fileFor(route: Route): string {
  if (route.path === null) return "404.html";
  return route.path === "/" ? "index.html" : `${route.path.slice(1)}/index.html`;
}

const template = await readFile(join(outDir, "index.html"), "utf8");
const preloads = await fontPreloads();
const routes = [...PAGE_PATHS.map(routeFor), NOT_FOUND];

for (const route of routes) {
  const file = fileFor(route);
  const head = [headHtml(headFor(route)), ...preloads].join("\n    ");
  let html = fill(template, "<!--app-head-->", head);
  html = fill(html, "__APP_PATH__", route.path ?? "/404.html");
  html = fill(html, "<!--app-html-->", await renderApp(route));
  assertCspSafe(file, html);
  const target = join(outDir, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  console.log(`prerendered ${file}`);
}

// Writes resume.pdf into the web build, which serves it at /resume.pdf.
// Usage: node dist/resume/build.mjs <web build dir>
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { content } from "../content/content.js";
import { renderResume } from "./resume.js";

const outDir = process.argv[2];
if (!outDir) throw new Error("Usage: build.mjs <web build dir>");
await writeFile(join(outDir, "resume.pdf"), await renderResume(content));

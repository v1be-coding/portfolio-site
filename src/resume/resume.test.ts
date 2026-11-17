import { describe, expect, it } from "vitest";
import { content } from "../content/content.js";
import { renderResume } from "./resume.js";

// The text and its order are checked by the frozen C7 test, which reads the
// built PDF with pdfjs. These check what that test can't see: the page box,
// the page count before deploy, and that the links are clickable.

describe("renderResume", () => {
  it("is a PDF of one or two A4 pages", async () => {
    const pdf = (await renderResume(content)).toString("latin1");

    expect(pdf.startsWith("%PDF-")).toBe(true);
    const pages = pdf.match(/\/Type \/Page\n/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.length).toBeLessThanOrEqual(2);
    const boxes = [...pdf.matchAll(/\/MediaBox \[([^\]]*)\]/g)].map((m) => m[1]);
    expect(boxes).toEqual(pages.map(() => "0 0 595.28 841.89"));
  });

  it("links the site, GitHub, LinkedIn and email", async () => {
    const pdf = (await renderResume(content)).toString("latin1");
    const uris = [...pdf.matchAll(/\/URI \(([^)]*)\)/g)].map((m) => m[1]);

    expect(uris).toEqual([
      "https://emilianocasijr.com",
      "https://github.com/emilianocasijr",
      "https://www.linkedin.com/in/emiliano-casi-jr",
      "mailto:casi.emilianojr@gmail.com",
    ]);
  });
});

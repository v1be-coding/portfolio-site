import PDFDocument from "pdfkit";
import { educationLine, experienceHeading, type Content } from "../content/content.js";

// Helvetica rather than the site's Atkinson Hyperlegible Next: fontkit 2.0.4
// subsets WOFF2 from its transformed glyf table, which corrupts glyphs and
// throws on composite ones such as "i". The standard fonts need no embedding,
// and every character in the content is in their WinAnsi encoding.
const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";

const INK = "#1A1A1A";
const MUTED = "#555555";
const ACCENT = "#1E6A49";
const RULE = "#C9D6CF";

const MARGIN = { top: 40, bottom: 36, left: 54, right: 54 };
const BODY_SIZE = 9.5;
const BULLET_INDENT = 11;

/** A link's visible text: the URL without its scheme or "www.". */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

/** The resume as A4 PDF bytes, built from the same content as the site. */
export function renderResume(content: Content): Promise<Buffer> {
  const { profile } = content;
  const doc = new PDFDocument({
    size: "A4",
    margins: MARGIN,
    font: REGULAR,
    lang: "en",
    displayTitle: true,
    info: { Title: `${profile.name} – Resume`, Author: profile.name, Subject: profile.tagline },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = MARGIN.left;
  const width = doc.page.width - MARGIN.left - MARGIN.right;

  // Moves to a new page unless `height` points still fit, so a heading never
  // ends a page without the line that follows it.
  const keep = (height: number) => {
    if (doc.y + height > doc.page.height - MARGIN.bottom) doc.addPage();
  };

  // A left-aligned label and right-aligned dates on one line. The label is drawn
  // first so text extraction reads it before the dates.
  const labelWithDates = (label: string, dates: string, font: string, size: number) => {
    const top = doc.y;
    doc.font(REGULAR).fontSize(size - 0.5);
    const datesWidth = doc.widthOfString(dates);
    doc.font(font).fontSize(size).fillColor(INK);
    doc.text(label, left, top, { width: width - datesWidth - 12 });
    const bottom = doc.y;
    doc
      .font(REGULAR)
      .fontSize(size - 0.5)
      .fillColor(MUTED);
    doc.text(dates, left, top + 0.5, { width, align: "right" });
    doc.y = Math.max(bottom, doc.y);
  };

  const bullets = (items: readonly string[]) => {
    doc.font(REGULAR).fontSize(BODY_SIZE);
    for (const item of items) {
      keep(doc.currentLineHeight(true) * 2);
      const top = doc.y + 1;
      doc.fillColor(ACCENT).text("•", left + 2, top);
      doc.fillColor(INK).text(item, left + BULLET_INDENT, top, {
        width: width - BULLET_INDENT,
        lineGap: 1.2,
      });
    }
  };

  const section = (title: string) => {
    keep(44);
    doc.moveDown(0.7);
    doc.font(BOLD).fontSize(11.5).fillColor(ACCENT).text(title, left, doc.y, { width });
    const ruleY = doc.y + 2;
    doc
      .moveTo(left, ruleY)
      .lineTo(left + width, ruleY)
      .lineWidth(0.6)
      .strokeColor(RULE)
      .stroke();
    doc.y = ruleY + 6;
  };

  // Header: name, tagline, availability, links.
  doc.font(BOLD).fontSize(22).fillColor(INK).text(profile.name, left, MARGIN.top, { width });
  doc.moveDown(0.15);
  doc.font(REGULAR).fontSize(11.5).fillColor(INK).text(profile.tagline, { width });
  doc.moveDown(0.2);
  doc.fontSize(BODY_SIZE).fillColor(MUTED).text(profile.availability, { width });
  doc.moveDown(0.5);

  const links = [
    { text: displayUrl(profile.site), href: profile.site },
    { text: displayUrl(profile.github), href: profile.github },
    { text: displayUrl(profile.linkedin), href: profile.linkedin },
    { text: profile.email, href: `mailto:${profile.email}` },
  ];
  doc.fontSize(BODY_SIZE);
  links.forEach((link, index) => {
    const last = index === links.length - 1;
    doc.fillColor(ACCENT).text(link.text, { link: link.href, continued: !last });
    if (!last) doc.fillColor(MUTED).text("   ·   ", { link: null, continued: true });
  });
  doc.moveDown(0.4);

  section("About");
  doc.font(REGULAR).fontSize(BODY_SIZE).fillColor(INK).text(profile.bio, left, doc.y, {
    width,
    lineGap: 1.5,
  });

  section("Experience");
  content.experience.forEach((experience, index) => {
    if (index > 0) doc.moveDown(0.8);
    keep(48);
    labelWithDates(experienceHeading(experience), experience.dates, BOLD, 10.5);
    if (experience.bullets.length > 0) doc.moveDown(0.2);
    bullets(experience.bullets);
    for (const engagement of experience.engagements) {
      doc.moveDown(0.45);
      keep(36);
      labelWithDates(engagement.name, engagement.dates, BOLD, BODY_SIZE + 0.5);
      doc.moveDown(0.1);
      bullets(engagement.bullets);
    }
  });

  section("Skills");
  for (const group of content.skills) {
    doc.font(BOLD).fontSize(BODY_SIZE).fillColor(INK);
    doc.text(`${group.label}: `, left, doc.y, { width, continued: true, lineGap: 1.5 });
    doc.font(REGULAR).text(group.items.join(", "), { lineGap: 1.5 });
  }

  section("Education");
  doc
    .font(REGULAR)
    .fontSize(BODY_SIZE)
    .fillColor(INK)
    .text(educationLine(content.education), left, doc.y, {
      width,
    });

  doc.end();
  return done;
}

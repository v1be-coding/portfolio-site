import { describe, expect, it } from "vitest";
import { content, educationLine, experienceHeading } from "./content.js";

// Expected values are copied from spec #2's Content section, not derived from
// the module, so a drifting edit fails here.

describe("profile", () => {
  it("is the spec's profile", () => {
    expect(content.profile).toEqual({
      name: "Emiliano Casi Jr",
      tagline: "Senior full-stack engineer building fintech and AI-first products.",
      availability:
        "Remote from the Philippines (GMT+8), working US, EU or APAC hours, full-time or contract.",
      bio: "Senior full-stack engineer (TypeScript, Node.js, React/Vue/Svelte) with 5+ years across fintech, real-time and AI-first products. Rebuilt a white-label banking platform with Claude Code, led a 5-person team on a hiring platform with 3,500+ users, and shipped template changes across tens of thousands of WebMD pages.",
      email: "casi.emilianojr@gmail.com",
      github: "https://github.com/emilianocasijr",
      linkedin: "https://www.linkedin.com/in/emiliano-casi-jr",
      site: "https://emilianocasijr.com",
    });
  });
});

describe("experience", () => {
  it("lists the roles newest first with their headings and dates", () => {
    expect(content.experience.map((e) => [experienceHeading(e), e.dates])).toEqual([
      ["Senior Software Engineer / Lead Developer, Prostrive (Remote)", "Mar 2023 – Present"],
      ["Software Engineer (Full Stack), WebMD (Remote)", "Mar 2021 – Mar 2023"],
    ]);
  });

  it("breaks Prostrive into its four Engagements, in order", () => {
    const prostrive = content.experience[0];
    expect(prostrive.company).toBe("Prostrive");
    expect(prostrive.bullets).toEqual([]);
    expect(prostrive.engagements.map((e) => [e.name, e.dates, e.bullets.length])).toEqual([
      ["White-label online banking platform", "Jun 2026 – Present", 5],
      ["Real-time multiplayer streaming platform", "Feb 2025 – Jun 2026", 2],
      ["Video-based hiring platform, Team Lead", "Jun 2024 – Feb 2025", 3],
      ["Real-money gaming platform", "May 2023 – Jun 2024", 1],
    ]);
    expect(prostrive.engagements[0].bullets[0]).toBe(
      "Rebuilt a live Go/Angular banking platform in TypeScript (NestJS, SvelteKit, Postgres per tenant, AWS ECS) with ~12 engineers in an AI-first Claude Code workflow: ~1,800 merged PRs in 6 months, launching soon.",
    );
    expect(prostrive.engagements[0].bullets[4]).toBe(
      "Wrote and maintained requirements docs and user journeys for Onboarding, Users & Profiles, Accounts & Ledger, Cards and Documents.",
    );
    expect(prostrive.engagements[2].bullets[0]).toBe(
      "Led 5 developers and mentored 3 junior engineers to deliver a video-first hiring platform, in production since Dec 2024 with 3,500+ registered users.",
    );
    expect(prostrive.engagements[3].bullets).toEqual([
      "Built a microservices backend with real-time gameplay (WebSockets, message queues) and crypto wallet deposit and withdrawal flows.",
    ]);
  });

  it("gives WebMD its bullets and no Engagements", () => {
    const webmd = content.experience[1];
    expect(webmd.engagements).toEqual([]);
    expect(webmd.bullets).toEqual([
      "Migrated legacy jQuery to Vue 2 in shared page templates rendering tens of thousands of pages on one of the largest consumer health sites.",
      "Kept templates at passing Core Web Vitals (team minimum) through bundle-size reduction, lazy loading and layout-shift fixes.",
      "Built responsive features on REST APIs and added unit and end-to-end tests to the release process.",
    ]);
  });
});

describe("skills and education", () => {
  it("groups the skills as the spec does", () => {
    expect(content.skills).toEqual([
      {
        label: "AI-first development",
        items: [
          "Claude Code",
          "AI-assisted testing and code review",
          "OpenAI API",
          "GCP Speech-to-Text",
        ],
      },
      {
        label: "Languages and data",
        items: ["TypeScript", "JavaScript", "Python", "SQL", "PostgreSQL", "MongoDB", "Redis"],
      },
      {
        label: "Backend",
        items: ["Node.js", "NestJS", "Express", "REST", "GraphQL", "WebSockets", "RabbitMQ"],
      },
      { label: "Frontend", items: ["React", "Next.js", "Vue", "SvelteKit", "Tailwind CSS"] },
      {
        label: "Cloud and DevOps",
        items: [
          "AWS (ECS, Lambda, Cognito)",
          "GCP",
          "Firebase",
          "Docker",
          "Kubernetes",
          "Terraform",
          "GitHub Actions",
          "GitLab CI",
          "Sentry",
        ],
      },
      {
        label: "Fintech and auth",
        items: ["Stripe", "crypto payments", "ZITADEL", "KYC onboarding", "multi-tenant systems"],
      },
      { label: "Testing", items: ["Jest", "Vitest", "Playwright", "Cypress"] },
    ]);
  });

  it("has the one education line", () => {
    expect(educationLine(content.education)).toBe(
      "BS Mechanical Engineering, Saint Louis University, 2020",
    );
  });
});

describe("series", () => {
  it("has the intro and four steps", () => {
    expect(content.series.intro).toBe(
      "V1be Coding is a build series about one skill: turning an idea into a spec clear enough that an AI agent builds a working, deployed app in one run. Every app has an AI feature, with rate limiting and a daily spend cap.",
    );
    expect(content.series.steps).toEqual([
      {
        title: "Spec",
        text: "The idea is questioned until it becomes a written spec, published as a GitHub issue.",
      },
      {
        title: "Frozen tests",
        text: "Tests are written from the spec before any code exists, and the run can't change them.",
      },
      {
        title: "One run",
        text: "Claude Code builds the app, deploys it to its own branch environment, and fixes what fails, with at most 5 failed rounds.",
      },
      {
        title: "Ship",
        text: "When every check passes, the app merges and deploys to production. A failed run goes back to the spec, with at most 3 attempts per episode.",
      },
    ]);
  });

  it("lists Episode 0 only, still in progress", () => {
    expect(content.episodes).toHaveLength(1);
    const episode = content.episodes[0];
    expect(episode).toMatchObject({
      number: 0,
      slug: "portfolio-site",
      title: "Portfolio site",
      summary:
        "This site: Emiliano's resume, the Series, and an AI chat that answers from the site's own content.",
      description:
        "This site is Episode 0 of V1be Coding. Emiliano and Claude worked out the spec together in a GitHub issue, and tests were written from it before any code existed. Then one Claude Code run wrote the code, deployed it, and fixed what failed until every test passed. Emiliano wrote no application code: Emiliano's part was the spec, the design direction and the content.",
      links: {
        live: "https://emilianocasijr.com",
        repository: "https://github.com/v1be-coding/portfolio-site",
        specIssue: "https://github.com/v1be-coding/portfolio-site/issues/2",
      },
      scorecard: null,
      demo: null,
      howItWorks: null,
      retro: null,
    });
  });
});

describe("privacy", () => {
  it("never holds the phone number", () => {
    const text = JSON.stringify(content);
    for (const fragment of ["950", "+63", "3959"]) expect(text).not.toContain(fragment);
  });
});

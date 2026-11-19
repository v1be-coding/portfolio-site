// Everything the site, the resume PDF and the Chat's system prompt show, in one
// place, so the three never drift (spec #2, Content). Dates are literal strings,
// never computed, so the prerendered HTML and the browser agree. The phone
// number never goes in here: this file is public and feeds the PDF.

type Profile = {
  name: string;
  tagline: string;
  availability: string;
  bio: string;
  email: string;
  github: string;
  linkedin: string;
  /** The production origin, without a trailing slash. */
  site: string;
};

export type Engagement = {
  name: string;
  dates: string;
  bullets: readonly string[];
};

export type Experience = {
  title: string;
  company: string;
  location: string;
  dates: string;
  /** Empty when the role is described only through its Engagements. */
  bullets: readonly string[];
  /** Empty for a role that wasn't split into Engagements. */
  engagements: readonly Engagement[];
};

type SkillGroup = { label: string; items: readonly string[] };

export type Education = { degree: string; school: string; year: string };

type SeriesStep = { title: string; text: string };

type Series = { intro: string; steps: readonly SeriesStep[] };

/** An Episode's results, as the series rules define them. */
export type Scorecard = {
  timeToGreen: string;
  attempts: number;
  testsPassingOnAttempt1: string;
  buildCost: string;
  model: string;
  specMissed: string;
  frozenTestsWrong: string;
};

type Demo = { src: string; alt: string; width: number; height: number };

export type Episode = {
  number: number;
  /** The last segment of the Episode's path, /v1be-coding/<slug>. */
  slug: string;
  title: string;
  summary: string;
  description: string;
  /** The Episode page's meta and Open Graph description. */
  shareDescription: string;
  links: { live: string; repository: string; specIssue: string };
  /** Null until the episode ends; the page then says it's in progress. */
  scorecard: Scorecard | null;
  /** Each null section shows "Added after the episode." */
  demo: Demo | null;
  howItWorks: string | null;
  retro: string | null;
};

export type Content = {
  profile: Profile;
  experience: readonly Experience[];
  skills: readonly SkillGroup[];
  education: Education;
  series: Series;
  episodes: readonly Episode[];
};

/** "Title, Company (Location)", as the home page's h3 shows a role. */
export function experienceHeading(experience: Experience): string {
  return `${experience.title}, ${experience.company} (${experience.location})`;
}

export function educationLine(education: Education): string {
  return `${education.degree}, ${education.school}, ${education.year}`;
}

export function episodePath(episode: Episode): string {
  return `/v1be-coding/${episode.slug}`;
}

export const content: Content = {
  profile: {
    name: "Emiliano Casi Jr",
    tagline: "Senior full-stack engineer building fintech and AI-first products.",
    availability:
      "Remote from the Philippines (GMT+8), working US, EU or APAC hours, full-time or contract.",
    bio: "Senior full-stack engineer (TypeScript, Node.js, React/Vue/Svelte) with 5+ years across fintech, real-time and AI-first products. Rebuilt a white-label banking platform with Claude Code, led a 5-person team on a hiring platform with 3,500+ users, and shipped template changes across tens of thousands of WebMD pages.",
    email: "casi.emilianojr@gmail.com",
    github: "https://github.com/emilianocasijr",
    linkedin: "https://www.linkedin.com/in/emiliano-casi-jr",
    site: "https://emilianocasijr.com",
  },
  experience: [
    {
      title: "Senior Software Engineer / Lead Developer",
      company: "Prostrive",
      location: "Remote",
      dates: "Mar 2023 – Present",
      bullets: [],
      engagements: [
        {
          name: "White-label online banking platform",
          dates: "Jun 2026 – Present",
          bullets: [
            "Rebuilt a live Go/Angular banking platform in TypeScript (NestJS, SvelteKit, Postgres per tenant, AWS ECS) with ~12 engineers in an AI-first Claude Code workflow: ~1,800 merged PRs in 6 months, launching soon.",
            "Owned customer onboarding and identity end to end: sign-up, consents, contact verification, KYC auto-approval, registration review, password reset with rate limiting, and ZITADEL org and role scoping.",
            "Merged 158 PRs (~9% of the team total) across the API gateway, IAM/auth, accounts and the bank staff portal.",
            "Matched production v2 behaviour through AI-assisted parity checks and test-first development (unit, database integration, Playwright end-to-end tests), with human sign-off on all money, permission and ledger logic.",
            "Wrote and maintained requirements docs and user journeys for Onboarding, Users & Profiles, Accounts & Ledger, Cards and Documents.",
          ],
        },
        {
          name: "Real-time multiplayer streaming platform",
          dates: "Feb 2025 – Jun 2026",
          bullets: [
            "Designed an event-driven Node.js microservices backend (WebSockets, RabbitMQ) for live multiplayer cloud-gaming sessions on AWS (Lambda, Cognito, GameLift Streams) and GCP.",
            "Integrated third-party payment and financial APIs for in-session transactions.",
          ],
        },
        {
          name: "Video-based hiring platform, Team Lead",
          dates: "Jun 2024 – Feb 2025",
          bullets: [
            "Led 5 developers and mentored 3 junior engineers to deliver a video-first hiring platform, in production since Dec 2024 with 3,500+ registered users.",
            "Built role-based job postings and applications, Stripe payments, Firebase auth and storage, and automated video transcription on GCP.",
            "Set up GitHub and GitLab CI/CD pipelines with automated unit and end-to-end tests on every merge request.",
          ],
        },
        {
          name: "Real-money gaming platform",
          dates: "May 2023 – Jun 2024",
          bullets: [
            "Built a microservices backend with real-time gameplay (WebSockets, message queues) and crypto wallet deposit and withdrawal flows.",
          ],
        },
      ],
    },
    {
      title: "Software Engineer (Full Stack)",
      company: "WebMD",
      location: "Remote",
      dates: "Mar 2021 – Mar 2023",
      bullets: [
        "Migrated legacy jQuery to Vue 2 in shared page templates rendering tens of thousands of pages on one of the largest consumer health sites.",
        "Kept templates at passing Core Web Vitals (team minimum) through bundle-size reduction, lazy loading and layout-shift fixes.",
        "Built responsive features on REST APIs and added unit and end-to-end tests to the release process.",
      ],
      engagements: [],
    },
  ],
  skills: [
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
  ],
  education: {
    degree: "BS Mechanical Engineering",
    school: "Saint Louis University",
    year: "2020",
  },
  series: {
    intro:
      "V1be Coding is a build series about one skill: turning an idea into a spec clear enough that an AI agent builds a working, deployed app in one run. Every app has an AI feature, with rate limiting and a daily spend cap.",
    steps: [
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
    ],
  },
  episodes: [
    {
      number: 0,
      slug: "portfolio-site",
      title: "Portfolio site",
      summary:
        "This site: Emiliano's resume, the Series, and an AI chat that answers from the site's own content.",
      description:
        "This site is Episode 0 of V1be Coding. Emiliano and Claude worked out the spec together in a GitHub issue, and tests were written from it before any code existed. Then one Claude Code run wrote the code, deployed it, and fixed what failed until every test passed. Emiliano wrote no application code: Emiliano's part was the spec, the design direction and the content.",
      shareDescription:
        "Episode 0 of V1be Coding: Emiliano Casi Jr's portfolio site, with an AI chat that answers from the site's own content.",
      links: {
        live: "https://emilianocasijr.com",
        repository: "https://github.com/v1be-coding/portfolio-site",
        specIssue: "https://github.com/v1be-coding/portfolio-site/issues/2",
      },
      scorecard: null,
      demo: null,
      howItWorks: null,
      retro: null,
    },
  ],
};

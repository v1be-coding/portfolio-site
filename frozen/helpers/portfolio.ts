// Expected values for the portfolio-site tests, copied from spec #2's body
// (Content, Head metadata, Headers and caching). Shared by the acceptance tests
// and the smoke tests, so the two can't drift.

export const ORIGIN = "https://emilianocasijr.com";

export const NAME = "Emiliano Casi Jr";
export const TAGLINE = "Senior full-stack engineer building fintech and AI-first products.";
export const AVAILABILITY = "Remote from the Philippines (GMT+8), working US, EU or APAC hours, full-time or contract.";
export const BIO =
  "Senior full-stack engineer (TypeScript, Node.js, React/Vue/Svelte) with 5+ years across fintech, real-time and AI-first products. Rebuilt a white-label banking platform with Claude Code, led a 5-person team on a hiring platform with 3,500+ users, and shipped template changes across tens of thousands of WebMD pages.";
export const EPISODE_SENTENCE =
  "This site is Episode 0 of V1be Coding, a series where each app goes from a written spec to a deployed site in one AI agent run.";
export const EMAIL = "casi.emilianojr@gmail.com";
export const GITHUB = "https://github.com/emilianocasijr";
export const LINKEDIN = "https://www.linkedin.com/in/emiliano-casi-jr";

export type Engagement = { name: string; dates: string; bullets: string[] };
export type Experience = { heading: string; company: string; dates: string; bullets: string[]; engagements: Engagement[] };

export const EXPERIENCE: Experience[] = [
  {
    heading: "Senior Software Engineer / Lead Developer, Prostrive (Remote)",
    company: "Prostrive",
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
    heading: "Software Engineer (Full Stack), WebMD (Remote)",
    company: "WebMD",
    dates: "Mar 2021 – Mar 2023",
    bullets: [
      "Migrated legacy jQuery to Vue 2 in shared page templates rendering tens of thousands of pages on one of the largest consumer health sites.",
      "Kept templates at passing Core Web Vitals (team minimum) through bundle-size reduction, lazy loading and layout-shift fixes.",
      "Built responsive features on REST APIs and added unit and end-to-end tests to the release process.",
    ],
    engagements: [],
  },
];

// An Experience's text in the site's order: heading, dates, bullets, then each
// Engagement's name, dates and bullets.
export function experienceSequence(experience: Experience): string[] {
  return [
    experience.heading,
    experience.dates,
    ...experience.bullets,
    ...experience.engagements.flatMap((engagement) => [engagement.name, engagement.dates, ...engagement.bullets]),
  ];
}

// Every company, Engagement name and date range, in the site's order (for the PDF).
export const RESUME_SEQUENCE = EXPERIENCE.flatMap((experience) => [
  experience.company,
  experience.dates,
  ...experience.engagements.flatMap((engagement) => [engagement.name, engagement.dates]),
]);

export const SKILLS: { label: string; items: string[] }[] = [
  { label: "AI-first development", items: ["Claude Code", "AI-assisted testing and code review", "OpenAI API", "GCP Speech-to-Text"] },
  { label: "Languages and data", items: ["TypeScript", "JavaScript", "Python", "SQL", "PostgreSQL", "MongoDB", "Redis"] },
  { label: "Backend", items: ["Node.js", "NestJS", "Express", "REST", "GraphQL", "WebSockets", "RabbitMQ"] },
  { label: "Frontend", items: ["React", "Next.js", "Vue", "SvelteKit", "Tailwind CSS"] },
  {
    label: "Cloud and DevOps",
    items: ["AWS (ECS, Lambda, Cognito)", "GCP", "Firebase", "Docker", "Kubernetes", "Terraform", "GitHub Actions", "GitLab CI", "Sentry"],
  },
  { label: "Fintech and auth", items: ["Stripe", "crypto payments", "ZITADEL", "KYC onboarding", "multi-tenant systems"] },
  { label: "Testing", items: ["Jest", "Vitest", "Playwright", "Cypress"] },
];

export const EDUCATION = "BS Mechanical Engineering, Saint Louis University, 2020";

export const SERIES_INTRO =
  "V1be Coding is a build series about one skill: turning an idea into a spec clear enough that an AI agent builds a working, deployed app in one run. Every app has an AI feature, with rate limiting and a daily spend cap.";
export const SERIES_STEPS = [
  "Spec. The idea is questioned until it becomes a written spec, published as a GitHub issue.",
  "Frozen tests. Tests are written from the spec before any code exists, and the run can't change them.",
  "One run. Claude Code builds the app, deploys it to its own branch environment, and fixes what fails, with at most 5 failed rounds.",
  "Ship. When every check passes, the app merges and deploys to production. A failed run goes back to the spec, with at most 3 attempts per episode.",
];
export const EPISODE_0_SUMMARY = "This site: Emiliano's resume, the Series, and an AI chat that answers from the site's own content.";
export const EPISODE_0_DESCRIPTION =
  "This site is Episode 0 of V1be Coding. Emiliano and Claude worked out the spec together in a GitHub issue, and tests were written from it before any code existed. Then one Claude Code run wrote the code, deployed it, and fixed what failed until every test passed. Emiliano wrote no application code: Emiliano's part was the spec, the design direction and the content.";

export type Head = { path: string; title: string; description: string; url: string };

export const HEADS: Head[] = [
  {
    path: "/",
    title: "Emiliano Casi Jr",
    description:
      "Emiliano Casi Jr is a senior full-stack engineer building fintech and AI-first products, working remotely from the Philippines.",
    url: `${ORIGIN}/`,
  },
  {
    path: "/v1be-coding",
    title: "V1be Coding · Emiliano Casi Jr",
    description: "V1be Coding is a build series where each app goes from a written spec to a deployed site in one AI agent run.",
    url: `${ORIGIN}/v1be-coding`,
  },
  {
    path: "/v1be-coding/portfolio-site",
    title: "Portfolio site · V1be Coding",
    description:
      "Episode 0 of V1be Coding: Emiliano Casi Jr's portfolio site, with an AI chat that answers from the site's own content.",
    url: `${ORIGIN}/v1be-coding/portfolio-site`,
  },
];

export const NOT_FOUND_TITLE = "Page not found";
export const NOT_FOUND_TEXT = "The page you asked for doesn't exist.";

export const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "x-xss-protection": undefined,
};

// The security headers a response has, plus x-xss-protection, which must be
// missing. Compare with SECURITY_HEADERS using toEqual.
export function securityHeadersOf(headers: Record<string, string>): Record<string, string | undefined> {
  return Object.fromEntries(Object.keys(SECURITY_HEADERS).map((name) => [name, headers[name]]));
}

export const CHAT = {
  name: "Ask about Emiliano",
  subtitle: "AI assistant. Answers come only from this site.",
  greeting: "Hi! Ask me about Emiliano's experience or the V1be Coding series.",
  suggestions: ["What does Emiliano work on?", "What is V1be Coding?", "How can I contact Emiliano?"],
};

// A log that holds only the greeting, with or without an "Assistant: " prefix
// (the greeting isn't a message, so the spec doesn't say whether it has one).
export const GREETING_ONLY = /^\s*(Assistant:\s*)?Hi! Ask me about Emiliano's experience or the V1be Coding series\.\s*$/;

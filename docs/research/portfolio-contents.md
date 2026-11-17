# What should a developer portfolio site contain?

_Practice: personal developer portfolio sites, including AI-built projects and "ask me" chatbots · researched 2026-11-17_

## TL;DR

- Projects are the signal. The site's design is not.
- Show **2–5 curated projects as case studies**, not a grid of everything. Each one should say the problem, your role, what was built and a measured result, with a working live link and repo.
- Make the strongest work, the contact and the resume or links findable within about 10 seconds.
- Biggest gotcha: anything vague or unverifiable reads as fake. That's worse in the AI era, so a case study for an AI-built app must say plainly what the agent did and what the human did.
- Chatbots: no reviewer evidence either way. Builders report prompt-injection attempts within hours. Scope the bot narrowly, label it as AI, and give it a way out to email.

## Documented / recommended

- Side projects or portfolios rank first among engineering leaders' signals that an entry-level candidate is ready (38%), ahead of internships (35%) and public code (34%). Survey of 200+ leaders, method unpublished — [Fortune / CodePath, Dec 2025](https://fortune.com/2025/12/18/tech-hiring-slow-but-not-fully-stalled-exclusive-codepath-data-new-secret-to-land-tech-role/)
- 84% of hiring managers look at a portfolio, usually GitHub. The resume still drives the first screen for 81% — [HackerRank 2018 via TechTarget](https://www.techtarget.com/searchsoftwarequality/news/252433885/Want-to-make-software-developer-hiring-easier-Be-flexible), [HackerRank recruiting report 2018](https://prnewswire.com/news-releases/new-hackerrank-research-uncovers-misalignment-between-technical-recruiters-and-hiring-managers-300652418.html)
- A few detailed case studies beat a large collection. Show process, constraints and value created, and make them scannable because managers rarely read word for word — [NN/g, UX portfolios (n=204)](https://www.nngroup.com/articles/ux-design-portfolios/)
- Lead with measured impact, write plainly for non-specialists, and don't bury projects far down the page — [NN/g, UX researcher portfolios (n=963)](https://www.nngroup.com/articles/ux-researcher-portfolio/)
- Visitors decide in 10–20 seconds whether to stay — [NN/g, dwell time](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/). The 7.4-second resume scan is often cited ([Ladders](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/)), but its method is undisclosed ([ERE critique](https://www.ere.net/articles/is-the-6-second-resume-scan-a-myth)).
- Evidence you can check and specific, personal writing stand out against AI-generated look-alike applications — [Stack Overflow blog, Oct 2026](https://stackoverflow.blog/2026/10/12/beyond-the-ai-noise-how-stack-overflow-is-rethinking-tech-hiring/)
- Treat it as a highlight reel, not an index of everything (2–5 projects). Guide the reader through each project, and write personal copy — [Josh Comeau, Building an Effective Dev Portfolio](https://joshwcomeau.com/effective-portfolio/)
- Visitors trust About content that's specific and authentic with an easy way to reach a real person, and dislike promotional copy ("marketese") — [NN/g, About Us](https://www.nngroup.com/articles/about-us-information-on-websites/)
- Basics: 53% of mobile visits leave a page that takes more than 3 seconds to load — [Think with Google](https://thinkwithgoogle.com/consumer-insights/consumer-trends/mobile-site-load-time-statistics/). 94.8% of top home pages fail WCAG, so an accessible site stands out — [WebAIM Million 2025](https://webaim.org/projects/million/2025)
- Site chatbots: users can't tell what they're for, so scope them narrowly, open with specific suggested prompts, give the answer first and keep it short, and if the bot can't help, say so in the first sentence and offer a human — NN/g 2026: [site-ai-chatbot](https://www.nngroup.com/articles/site-ai-chatbot/), [less-chat-more-answer](https://www.nngroup.com/articles/less-chat-more-answer/), [10 guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)

## Field reports

_Mostly Hacker News. Reddit couldn't be reached, so the junior and front-end view is probably under-sampled, and HN skews senior and backend._

### Project content matters, not site design or framework — Strong pattern (~8 reporters, 4 stating hiring roles)

Hiring managers open linked live sites and repos and have candidates talk through them. One job seeker found project content "an order of magnitude more important than the design of the personal site."
Sources: [HN 2024 thread](https://news.ycombinator.com/item?id=40860643), [sontek](https://news.ycombinator.com/item?id=40861251), [HN 2025](https://news.ycombinator.com/item?id=45273403), [side projects that landed jobs](https://news.ycombinator.com/item?id=38511280)

### Tutorial clones and generic CRUD apps are a turn-off — Strong pattern (6 reporters, 3 hiring or interviewing)

AI is said to make generic apps cheaper to fake and so worth even less. Hard projects, or ones with real users, stand out.
Sources: [HN 2025](https://news.ycombinator.com/item?id=45273403), [HN 2023 review](https://news.ycombinator.com/item?id=35102951)

### Vague or unverifiable claims read as fake — Strong pattern (3 reporters, one highly specific teardown)

Red flags: screenshots with no stated personal contribution, "award-winning" claims, old client-site links, fade-in text in quirky fonts, and claims that don't match the resume.
Sources: [Aurornis teardown](https://news.ycombinator.com/item?id=43978405), [HN 2023 review](https://news.ycombinator.com/item?id=35102951)

### Make things findable: strongest work first, live demo, resume or links, contact near the top — Strong pattern (5 reporters)

Slow scroll animations and a hard-to-find demo button drew complaints. One offer came through an email address on a GitHub profile.
Sources: [HN 2023 review](https://news.ycombinator.com/item?id=35102951), [side projects thread](https://news.ycombinator.com/item?id=38511280)

### Portfolios count for little next to the resume and experience for senior or backend devs, but help juniors and front-end devs — Strong pattern, split by seniority (~10 vs ~7 reporters)

Sources: [backend portfolios](https://news.ycombinator.com/item?id=43270627), [Aurornis 2026](https://news.ycombinator.com/item?id=47280036), [Peroni 2026](https://news.ycombinator.com/item?id=47410236), [HN 2023](https://news.ycombinator.com/item?id=37296247)

### Writing (case studies, dev journals, blog) adds credibility — Strong pattern (5 reporters)

Sources: [HN 2025](https://news.ycombinator.com/item?id=45273403), [side projects thread](https://news.ycombinator.com/item?id=38511280), [Simon Willison](https://simonwillison.net/2022/Nov/6/what-to-blog-about/), [swyx](https://www.swyx.io/learn-in-public)

### The site's own craft gets checked (performance, standards, view source) — Emerging (3 reporters, 2 hiring)

Sources: [HN 2024 thread](https://news.ycombinator.com/item?id=40860643)

### Portfolio chatbots attract prompt injection quickly — Anecdote (1 builder, qualitative)

"Within hours of deploying the first version, I saw prompt injection attempts in the logs." — [Cameron Rye, Jan 2026](https://ryedev.pages.dev/blog/building-ask-rag-portfolio-chatbot)

### Chatbot logs show what the site doesn't cover — Anecdote (1 builder)

Questions people asked revealed topics missing from the site — [Kolbey Pruitt, Feb 2026](https://kolbeypruitt-com.pages.dev/blog/portfolio-ai-chatbot)

### Recruiters respond to portfolio chatbots — Anecdote (1 self-report, re-syndicated)

328 visitors and 492 questions in 30 days. The builder says it led to interviews. No recruiter is quoted — [jobadvisor, Apr 2026](https://www.jobadvisor.link/2026/04/these-two-job-seekers-built-ai-chatbots.html)

## Official vs reality

- Surveys say most hiring managers look at portfolios (84%, CodePath's first place). HN reviewers say they matter little against the resume once you're past about 5 years, and several report interviewers who refused to look at code at all. Status: contested; it depends on seniority and role.
- NN/g says site chatbots must be narrowly scoped and get to the point. Builders' portfolio bots are often "ask me anything" bots with no usage data. Status: no evidence on portfolio bots from the reviewer side.

## Workarounds / what works

- Case studies that state the problem, your contribution, what was built and a measured result — NN/g, Comeau, plus 3 community reporters
- Real metrics and working links, for AI-built work especially — Stack Overflow 2026, plus the "reads as fake" cluster
- Bot hardening: rate limits, token caps, a cap on conversation length and a scope-restricting system prompt — reported by 3 builders ([Rye](https://ryedev.pages.dev/blog/building-ask-rag-portfolio-chatbot), [Pruitt](https://kolbeypruitt-com.pages.dev/blog/portfolio-ai-chatbot), [Suganthan](https://suganthan.com/blog/ai-chat-on-my-website/))

## Gaps

- Reddit wasn't reachable (r/cscareerquestions, r/webdev).
- No credible figure for how long a reviewer spends on a developer portfolio.
- No recruiter or hiring-manager opinion on portfolio chatbots, positive or negative.
- No survey on whether reviewers check accessibility or performance. The case for both is inferred from general web research.

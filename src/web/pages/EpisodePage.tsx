import type { ReactNode } from "react";
import type { Episode, Scorecard } from "../../content/content.js";
import "./EpisodePage.css";

const NOT_YET = "Added after the episode.";

const SCORECARD_ROWS: readonly (readonly [label: string, value: (s: Scorecard) => string])[] = [
  ["Time to green", (s) => s.timeToGreen],
  ["Attempts", (s) => String(s.attempts)],
  ["Tests passing on attempt 1", (s) => s.testsPassingOnAttempt1],
  ["Build cost", (s) => s.buildCost],
  ["Model", (s) => s.model],
  ["What the spec missed", (s) => s.specMissed],
  ["Frozen tests that were wrong", (s) => s.frozenTestsWrong],
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="episode-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function TextOrPending({ text }: { text: string | null }) {
  return text === null ? <p className="episode-pending">{NOT_YET}</p> : <p>{text}</p>;
}

export function EpisodePage({ episode }: { episode: Episode }) {
  const { demo, scorecard, howItWorks, retro, links } = episode;
  return (
    <article className="episode">
      <header className="episode-header">
        <h1>{episode.title}</h1>
        <p className="episode-number">Episode {episode.number}</p>
      </header>

      <Section id="episode-about" title="About this episode">
        <p>{episode.description}</p>
      </Section>

      <Section id="episode-demo" title="Demo">
        {demo === null ? (
          <TextOrPending text={null} />
        ) : (
          <img
            className="episode-demo"
            src={demo.src}
            alt={demo.alt}
            width={demo.width}
            height={demo.height}
          />
        )}
      </Section>

      <Section id="episode-links" title="Links">
        <ul className="episode-links">
          <li>
            <a href={links.live}>Live site</a>
          </li>
          <li>
            <a href={links.repository}>Repository</a>
          </li>
          <li>
            <a href={links.specIssue}>Spec issue</a>
          </li>
        </ul>
      </Section>

      <Section id="episode-scorecard" title="Scorecard">
        {scorecard === null ? (
          <p className="episode-pending">
            In progress. The Scorecard is added when the episode ends.
          </p>
        ) : (
          <dl className="episode-scorecard">
            {SCORECARD_ROWS.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value(scorecard)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section id="episode-how" title="How it works">
        <TextOrPending text={howItWorks} />
      </Section>

      <Section id="episode-retro" title="Retro">
        <TextOrPending text={retro} />
      </Section>
    </article>
  );
}

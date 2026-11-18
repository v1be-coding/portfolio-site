import { content, episodePath, type Episode } from "../../content/content.js";
import "./SeriesPage.css";

function scorecardLine({ scorecard }: Episode): string {
  if (scorecard === null) return "Scorecard: in progress";
  const attempts = scorecard.attempts === 1 ? "1 attempt" : `${scorecard.attempts} attempts`;
  return `Scorecard: green in ${scorecard.timeToGreen}, ${attempts}`;
}

export function SeriesPage() {
  const { intro, steps } = content.series;
  return (
    <div className="series">
      <header className="series-block">
        <h1>V1be Coding</h1>
        <p>{intro}</p>
      </header>

      <section className="series-block" aria-labelledby="series-steps">
        <h2 id="series-steps">How it works</h2>
        <ol className="series-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}.</strong> {step.text}
            </li>
          ))}
        </ol>
      </section>

      <section className="series-block" aria-labelledby="series-episodes">
        <h2 id="series-episodes">Episodes</h2>
        <ul className="series-episodes">
          {content.episodes.map((episode) => (
            <li key={episode.slug}>
              <a className="series-episode-link" href={episodePath(episode)}>
                Episode {episode.number}: {episode.title}
              </a>
              <p>{episode.summary}</p>
              <p className="series-episode-meta">{scorecardLine(episode)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

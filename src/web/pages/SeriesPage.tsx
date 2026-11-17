import { content, episodePath } from "../../content/content.js";

export function SeriesPage() {
  return (
    <>
      <h1>V1be Coding</h1>
      <p>{content.series.intro}</p>
      <ul>
        {content.episodes.map((episode) => (
          <li key={episode.slug}>
            <a href={episodePath(episode)}>
              Episode {episode.number}: {episode.title}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

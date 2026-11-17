import type { Episode } from "../../content/content.js";

export function EpisodePage({ episode }: { episode: Episode }) {
  return (
    <>
      <h1>{episode.title}</h1>
      <p>Episode {episode.number}</p>
      <p>{episode.description}</p>
    </>
  );
}

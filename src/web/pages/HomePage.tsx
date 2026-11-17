import { content } from "../../content/content.js";

// The page's h1 is the name, in the shell's header.
export function HomePage() {
  return (
    <section id="about" aria-labelledby="about-heading">
      <h2 id="about-heading">About</h2>
      <p>{content.profile.bio}</p>
    </section>
  );
}

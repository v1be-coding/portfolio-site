import {
  content,
  educationLine,
  episodePath,
  experienceHeading,
  type Engagement,
  type Episode,
  type Experience,
} from "../../content/content.js";
import "./HomePage.css";

// This site is Episode 0; the sentence and its link both follow that episode.
const thisEpisode = ((): Episode => {
  const episode = content.episodes.find((candidate) => candidate.number === 0);
  if (!episode) throw new Error("content.episodes has no Episode 0");
  return episode;
})();

function Bullets({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="entry-bullets">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function EngagementEntry({ engagement }: { engagement: Engagement }) {
  return (
    <li className="engagement">
      <h4>{engagement.name}</h4>
      <p className="entry-dates">{engagement.dates}</p>
      <Bullets items={engagement.bullets} />
    </li>
  );
}

function ExperienceEntry({ experience }: { experience: Experience }) {
  return (
    <article className="experience-entry">
      <h3>{experienceHeading(experience)}</h3>
      <p className="entry-dates">{experience.dates}</p>
      <Bullets items={experience.bullets} />
      {experience.engagements.length > 0 && (
        <ul className="engagements">
          {experience.engagements.map((engagement) => (
            <EngagementEntry key={engagement.name} engagement={engagement} />
          ))}
        </ul>
      )}
    </article>
  );
}

// The page's h1 is the name, in the shell's header.
export function HomePage() {
  const { profile, experience, skills, education } = content;
  return (
    <div className="home">
      <section id="about" aria-labelledby="about-heading">
        <h2 id="about-heading">About</h2>
        <div className="about-text">
          <p>{profile.bio}</p>
          <p>
            This site is{" "}
            <a href={episodePath(thisEpisode)}>Episode {thisEpisode.number} of V1be Coding</a>, a
            series where each app goes from a written spec to a deployed site in one AI agent run.
          </p>
        </div>
      </section>

      <section id="experience" aria-labelledby="experience-heading">
        <h2 id="experience-heading">Experience</h2>
        <div className="experience-list">
          {experience.map((role) => (
            <ExperienceEntry key={experienceHeading(role)} experience={role} />
          ))}
        </div>
      </section>

      <section id="skills" aria-labelledby="skills-heading">
        <h2 id="skills-heading">Skills</h2>
        <dl className="skills-list">
          {skills.map((group) => (
            <div key={group.label} className="skills-group">
              <dt>{group.label}</dt>
              <dd>{group.items.join(", ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="education" aria-labelledby="education-heading">
        <h2 id="education-heading">Education</h2>
        <p>{educationLine(education)}</p>
      </section>
    </div>
  );
}

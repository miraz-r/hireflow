import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import './AboutPage.css';

const PRINCIPLES = [
  {
    number: '01',
    title: 'Transparency',
    body: 'Salary ranges, company cultures, and process timelines should all be visible upfront.',
  },
  {
    number: '02',
    title: 'Quality',
    body: 'A curated set of relevant opportunities beats an endless, unfiltered feed.',
  },
  {
    number: '03',
    title: 'Respect',
    body: 'Whether you are applying or hiring, the process should respect your time.',
  },
  {
    number: '04',
    title: 'Human judgment',
    body: 'We build tools that help people make better decisions, not replace them.',
  },
];

export default function AboutPage() {
  return (
    <div className="about-page">
      {/* ── HERO ── */}
      <section className="about-hero">
        <div className="about-hero-glow" aria-hidden="true" />
        <div className="about-hero-glow about-hero-glow--secondary" aria-hidden="true" />
        <div className="container about-hero-layout">
          <div className="about-hero-content">
            <Reveal>
              <span className="about-hero-eyebrow">Our story</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="about-hero-title">
                Building a better way to find work.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="about-hero-desc">
                HireFlow connects talent with opportunity. We are building a calmer,
                clearer job marketplace for everyone.
              </p>
            </Reveal>
          </div>
          <Reveal delay={240} className="about-hero-visual">
            <div className="about-hero-visual-card">
              <span className="about-hero-visual-label">Built around</span>
              <div className="about-hero-visual-items">
                <span className="about-hero-visual-pill">Transparency</span>
                <span className="about-hero-visual-pill">Better matching</span>
                <span className="about-hero-visual-pill">Human judgment</span>
                <span className="about-hero-visual-pill">Respect for people's time</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="about-mission">
        <div className="container">
          <Reveal>
            <span className="about-section-eyebrow">Our mission</span>
          </Reveal>
          <Reveal delay={80}>
            <blockquote className="about-mission-statement">
              Job searching should not feel like a second job.
            </blockquote>
          </Reveal>
          <Reveal delay={160}>
            <p className="about-mission-body">
              We started HireFlow because we believed the hiring process could be
              better. More transparent for candidates, more efficient for employers,
              and more human for everyone involved. Today, we are building the tools
              that make that vision real.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── PRINCIPLES ── */}
      <section className="about-principles">
        <div className="container">
          <Reveal>
            <span className="about-section-eyebrow">What we believe</span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="about-principles-heading">
              The ideas that guide every decision.
            </h2>
          </Reveal>
          <div className="about-principles-grid">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.number} delay={100 + i * 80}>
                <div className="about-principle">
                  <span className="about-principle-number">{p.number}</span>
                  <h3 className="about-principle-title">{p.title}</h3>
                  <p className="about-principle-body">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="about-cta">
        <div className="about-cta-glow" aria-hidden="true" />
        <div className="container about-cta-inner">
          <Reveal>
            <h2 className="about-cta-heading">
              Help us build a better way to work.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="about-cta-desc">
              We are a small team working on something that matters. If you care
              about craft and want to do meaningful work, we would like to hear
              from you.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <Link to="/careers" className="btn btn-primary btn-lg">
              Join the team
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

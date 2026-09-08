import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import './PressPage.css';

const COVERAGE = [
  {
    source: 'TechCrunch',
    title: 'HireFlow raises Series A to expand job marketplace',
    description: "TechCrunch covers HireFlow's funding round and vision for transparent hiring.",
    link: '/press',
  },
  {
    source: 'Forbes',
    title: 'The startup making job searches less painful',
    description: "Forbes profiles HireFlow's approach to curating quality opportunities.",
    link: '/press',
  },
  {
    source: 'Wall Street Journal',
    title: 'How HireFlow is changing salary transparency',
    description: 'The Wall Street Journal explores the impact of visible salary ranges on job markets.',
    link: '/press',
  },
];

export default function PressPage() {
  return (
    <div className="press-page">
      {/* ── HERO ── */}
      <section className="press-hero">
        <div className="press-hero-glow" aria-hidden="true" />
        <div className="press-hero-glow press-hero-glow--secondary" aria-hidden="true" />
        <div className="container press-hero-layout">
          <div className="press-hero-content">
            <span className="press-hero-eyebrow">Newsroom</span>
            <h1 className="press-hero-title">Press</h1>
            <p className="press-hero-desc">
              Press releases, media kits, and contact information for journalists covering HireFlow.
            </p>
          </div>
          <div className="press-hero-visual">
            <div className="press-hero-visual-stat">
              <div className="press-hero-visual-label">Publications</div>
              <div className="press-hero-visual-count">3</div>
              <div className="press-hero-visual-desc">In major outlets</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRESS INQUIRIES ── */}
      <section className="press-inquiries">
        <div className="container">
          <Reveal>
            <span className="press-section-eyebrow">Press inquiries</span>
          </Reveal>
          <div className="press-inquiries-layout">
            <Reveal delay={80}>
              <div className="press-inquiries-text">
                <h2 className="press-inquiries-heading">
                  Reach out to our press team
                </h2>
                <p className="press-inquiries-body">
                  For media inquiries, interview requests, or to request our brand assets,
                  send us a message. We respond to all legitimate press inquiries
                  within one business day.
                </p>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <aside className="press-contact-aside">
                <div className="press-contact-item">
                  <span className="press-contact-label">Response time</span>
                  <p className="press-contact-value">Within one business day</p>
                </div>
                <div className="press-contact-item">
                  <span className="press-contact-label">Brand assets</span>
                  <p className="press-contact-value">Available on request</p>
                </div>
              </aside>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── RECENT COVERAGE ── */}
      <section className="press-coverage">
        <div className="container">
          <Reveal>
            <span className="press-section-eyebrow">Recent coverage</span>
          </Reveal>
          <h2 className="press-coverage-heading">What the press is saying about HireFlow</h2>
          <div className="press-coverage-grid">
            {COVERAGE.map((item, i) => (
              <Reveal key={item.source} delay={100 + i * 80}>
                <article className="press-coverage-card">
                  <span className="press-coverage-source">{item.source}</span>
                  <h3 className="press-coverage-title">{item.title}</h3>
                  <p className="press-coverage-desc">{item.description}</p>
                  <Link to={item.link} className="press-coverage-link">
                    Read more
                    <svg
                      className="press-coverage-arrow"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="press-cta">
        <div className="press-cta-glow" aria-hidden="true" />
        <div className="container press-cta-inner">
          <Reveal>
            <h2 className="press-cta-heading">Learn more about HireFlow</h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="press-cta-desc">
              Discover our mission, team, and the story behind the platform.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <Link to="/about" className="btn btn-lg press-cta-btn">
              About HireFlow
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

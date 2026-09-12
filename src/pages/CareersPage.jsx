import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import './CareersPage.css';

const POSITIONS = [
  {
    category: 'Engineering',
    title: 'Senior Frontend Engineer',
    description: 'Build the interfaces that thousands of jobseekers and employers use every day. React, TypeScript, and a passion for craft.',
    link: '/register',
  },
  {
    category: 'Design',
    title: 'Product Designer',
    description: 'Shape the experience from search to hire. Own the design process end-to-end in a small, collaborative team.',
    link: '/register',
  },
  {
    category: 'Engineering',
    title: 'Data Engineer',
    description: 'Build the infrastructure behind our matching algorithms and salary insights. Python, Spark, and curiosity required.',
    link: '/register',
  },
  {
    category: 'Content',
    title: 'Content Writer',
    description: 'Craft guides, blog posts, and resources that help people navigate their careers with confidence.',
    link: '/register',
  },
];

const BENEFITS = [
  'Competitive salary and equity packages for all full-time roles.',
  'Flexible remote-first culture with optional co-working spaces.',
  'Health, dental, and vision insurance from day one.',
  'Generous PTO and learning budget for professional development.',
  'A small team where your work has visible, direct impact.',
];

export default function CareersPage() {
  return (
    <div className="careers-page">
      {/* ── HERO ── */}
      <section className="careers-hero">
        <div className="careers-hero-glow" aria-hidden="true" />
        <div className="careers-hero-glow careers-hero-glow--secondary" aria-hidden="true" />
        <div className="container careers-hero-layout">
          <div className="careers-hero-content">
            <span className="careers-hero-eyebrow">Join the team</span>
            <h1 className="careers-hero-title">Build the future of work with us.</h1>
            <p className="careers-hero-desc">We are always looking for passionate people to join our team.</p>
          </div>
          <div className="careers-hero-visual">
            <div className="careers-hero-visual-card">
              <span className="careers-hero-visual-label">Open roles</span>
              <div className="careers-hero-visual-count">{POSITIONS.length}</div>
              <span className="careers-hero-visual-desc">positions</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── OPEN POSITIONS ── */}
      <section className="careers-positions">
        <div className="container">
          <Reveal>
            <div className="section-intro">
              <span className="careers-section-eyebrow">Open positions</span>
              <h2 className="careers-section-heading">Roles we're hiring for.</h2>
            </div>
          </Reveal>
          <div className="careers-positions-list">
            {POSITIONS.map((pos, i) => (
              <Reveal key={pos.title} delay={100 + i * 80}>
                <Link to={pos.link} className="careers-position-item">
                  <span className="careers-position-category">{pos.category}</span>
                  <h3 className="careers-position-title">{pos.title}</h3>
                  <p className="careers-position-desc">{pos.description}</p>
                  <span className="careers-position-link">Apply →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE OFFER ── */}
      <section className="careers-benefits">
        <div className="container">
          <Reveal>
            <div className="section-intro">
              <span className="careers-section-eyebrow">What we offer</span>
              <h2 className="careers-section-heading">More than a job.</h2>
            </div>
          </Reveal>
          <div className="careers-benefits-grid">
            {BENEFITS.map((benefit, i) => (
              <Reveal key={i} delay={100 + i * 60}>
                <div className="careers-benefit-card">
                  <span className="careers-benefit-dot" aria-hidden="true" />
                  <p className="careers-benefit-text">{benefit}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="careers-cta">
        <div className="careers-cta-glow" aria-hidden="true" />
        <div className="container careers-cta-inner">
          <Reveal>
            <h2 className="careers-cta-heading">Ready to join us?</h2>
            <p className="careers-cta-desc">Work on meaningful problems alongside people who care about craft.</p>
            <Link to="/" className="btn btn-primary btn-lg">See open roles</Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

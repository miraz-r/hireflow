import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import './CareerAdvicePage.css';

const ARTICLES = [
  {
    id: 1,
    category: 'Resumes',
    title: 'Writing a resume that gets interviews',
    description: 'How to structure your resume, highlight impact, and tailor it for each application without starting from scratch every time.',
    slug: 'writing-a-resume-that-gets-interviews',
  },
  {
    id: 2,
    category: 'Interviews',
    title: 'Acing the behavioral interview',
    description: 'Use the STAR method to tell compelling stories about your experience. We break down the most common questions and how to prepare.',
    slug: 'acing-the-behavioral-interview',
  },
  {
    id: 3,
    category: 'Strategy',
    title: 'When to make a career pivot',
    description: 'Signs it is time for a change, how to transfer skills between industries, and building credibility in a new field.',
    slug: 'when-to-make-a-career-pivot',
  },
  {
    id: 4,
    category: 'Negotiation',
    title: 'Negotiating your first offer',
    description: 'A step-by-step guide to evaluating compensation packages and having the conversation with confidence.',
    slug: 'negotiating-your-first-offer',
  },
  {
    id: 5,
    category: 'Remote Work',
    title: 'Thriving in a remote role',
    description: 'Communication habits, workspace setup, and routines that help remote employees stay visible and productive.',
    slug: 'thriving-in-a-remote-role',
  },
  {
    id: 6,
    category: 'Branding',
    title: 'Building your personal brand',
    description: 'How to position yourself as a thought leader through your portfolio, LinkedIn, and professional network.',
    slug: 'building-your-personal-brand',
  },
];

const FEATURED = ARTICLES[0];
const REMAINING = ARTICLES.slice(1);

const BookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
  </svg>
);

export default function CareerAdvicePage() {
  return (
    <div className="career-advice-page">
      {/* ── HERO ── */}
      <section className="ca-hero">
        <div className="ca-hero-glow" aria-hidden="true" />
        <div className="ca-hero-glow ca-hero-glow--secondary" aria-hidden="true" />
        <div className="container ca-hero-layout">
          <div className="ca-hero-content">
            <span className="ca-hero-eyebrow">For job seekers</span>
            <h1 className="ca-hero-title">Career Advice</h1>
            <p className="ca-hero-desc">
              Practical advice on resumes, interviews, and navigating your next career move from the HireFlow team.
            </p>
          </div>
          <div className="ca-hero-visual">
            <div className="ca-hero-visual-card">
              <span className="ca-hero-visual-label">Career guides</span>
              <div className="ca-hero-visual-count">{ARTICLES.length}</div>
              <span className="ca-hero-visual-desc">Practical guides for your next move</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED ARTICLE ── */}
      <section className="ca-featured">
        <div className="container">
          <Reveal>
            <span className="ca-section-eyebrow">Featured</span>
          </Reveal>
          <div className="ca-featured-layout">
            <Reveal delay={80}>
              <Link to={`/resources/${FEATURED.slug}`} className="ca-featured-card">
                <span className="ca-featured-category">{FEATURED.category}</span>
                <h2 className="ca-featured-title">{FEATURED.title}</h2>
                <p className="ca-featured-desc">{FEATURED.description}</p>
                <span className="ca-featured-link">
                  Read more <ArrowIcon />
                </span>
              </Link>
            </Reveal>
            <Reveal delay={160} className="ca-featured-sidebar">
              <div className="ca-featured-preview">
                <span className="ca-featured-preview-label">From the team</span>
                <p className="ca-featured-preview-text">
                  Every guide is written by people who have been through the same hiring processes you are navigating.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── ARTICLE GRID ── */}
      <section className="ca-articles">
        <div className="container">
          <Reveal>
            <span className="ca-section-eyebrow">All guides</span>
            <h2 className="ca-articles-heading">Practical guidance for every stage.</h2>
          </Reveal>
          <div className="ca-articles-grid">
            {REMAINING.map((article, i) => (
              <Reveal key={article.id} delay={100 + i * 80}>
                <Link to={`/resources/${article.slug}`} className="ca-article-card">
                  <span className="ca-article-category">{article.category}</span>
                  <h3 className="ca-article-title">{article.title}</h3>
                  <p className="ca-article-desc">{article.description}</p>
                  <span className="ca-article-link">
                    <BookIcon /> Read guide
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ca-cta">
        <div className="ca-cta-glow" aria-hidden="true" />
        <div className="container ca-cta-inner">
          <Reveal>
            <h2 className="ca-cta-heading">Find your next role.</h2>
            <p className="ca-cta-desc">
              Start browsing open positions and put your new skills into action.
            </p>
            <Link to="/" className="btn btn-primary btn-lg">
              Find your next opportunity
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, RESOURCES, getResourcesByCategory } from '../data/resources';
import './ResourcesPage.css';

const FEATURED_GRID = [
  { ...RESOURCES.find((r) => r.slug === 'how-to-choose-the-right-role'), size: 'large' },
  { ...RESOURCES.find((r) => r.slug === 'negotiating-your-first-offer'), size: 'medium' },
  { ...RESOURCES.find((r) => r.slug === 'acing-the-behavioral-interview'), size: 'medium' },
  { ...RESOURCES.find((r) => r.slug === 'rise-of-skills-based-hiring'), size: 'wide' },
  { ...RESOURCES.find((r) => r.slug === 'questions-before-accepting-an-offer'), size: 'small' },
  { ...RESOURCES.find((r) => r.slug === 'when-to-make-a-career-pivot'), size: 'tall' },
  { ...RESOURCES.find((r) => r.slug === 'building-your-personal-brand'), size: 'small' },
];

const ARTICLE_RESOURCES = [
  RESOURCES.find((r) => r.slug === 'writing-a-resume-that-gets-interviews'),
  RESOURCES.find((r) => r.slug === 'thriving-in-a-remote-role'),
  RESOURCES.find((r) => r.slug === 'preparing-for-technical-interviews'),
  RESOURCES.find((r) => r.slug === 'understanding-total-compensation'),
  RESOURCES.find((r) => r.slug === 'researching-company-culture'),
  RESOURCES.find((r) => r.slug === 'in-demand-skills'),
];

const RECENT_RESOURCES = [
  RESOURCES.find((r) => r.slug === 'questions-before-accepting-an-offer'),
  RESOURCES.find((r) => r.slug === 'preparing-for-technical-interviews'),
  RESOURCES.find((r) => r.slug === 'researching-company-culture'),
  RESOURCES.find((r) => r.slug === 'negotiating-your-first-offer'),
];

const POPULAR_RESOURCES = [
  RESOURCES.find((r) => r.slug === 'building-your-personal-brand'),
  RESOURCES.find((r) => r.slug === 'when-to-make-a-career-pivot'),
  RESOURCES.find((r) => r.slug === 'rise-of-skills-based-hiring'),
  RESOURCES.find((r) => r.slug === 'understanding-total-compensation'),
];

const EXPERTISE = [
  { title: 'Career Strategy', desc: 'Long-term planning, transitions, and growth.' },
  { title: 'Interview Coaching', desc: 'Preparation, storytelling, and confidence.' },
  { title: 'Compensation', desc: 'Negotiation, benchmarks, and total package evaluation.' },
  { title: 'Job Market Analysis', desc: 'Trends, in-demand skills, and hiring patterns.' },
];

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7" /><path d="M7 7h10v10" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const iconMap = {
  compass: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  ),
  mic: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  trending: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  user: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

function FeaturedCard({ item }) {
  return (
    <Link
      to={`/resources/${item.slug}`}
      className={`res-featured-item res-featured-item--${item.size}`}
    >
      <div className="res-featured-img-wrap">
        <img
          src={item.image}
          alt={item.title}
          className="res-featured-img"
          loading="lazy"
        />
      </div>
      <div className="res-featured-overlay">
        <span className="res-featured-cat">{item.category}</span>
        <h3 className="res-featured-heading">{item.title}</h3>
        {item.description && (
          <p className="res-featured-excerpt">{item.description}</p>
        )}
        <span className="res-featured-link">
          Read More <ChevronIcon />
        </span>
      </div>
    </Link>
  );
}

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState('idle'); // idle | error | success
  const [newsletterError, setNewsletterError] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);

  const filteredArticles = getResourcesByCategory(activeCategory).filter(
    (r) => !FEATURED_GRID.some((f) => f.slug === r.slug)
  );

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat);
  }, []);

  const validateEmail = (email) => {
    if (!email.trim()) return 'Please enter your email address.';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return 'Please enter a valid email address.';
    return '';
  };

  const handleNewsletterSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const err = validateEmail(newsletterEmail);
      if (err) {
        setNewsletterState('error');
        setNewsletterError(err);
        return;
      }
      setNewsletterSubmitting(true);
      // Simulate submission
      setTimeout(() => {
        setNewsletterState('success');
        setNewsletterSubmitting(false);
      }, 800);
    },
    [newsletterEmail]
  );

  return (
    <div className="resources-page">
      {/* 1. Hero */}
      <section className="res-hero">
        <div className="container">
          <span className="res-hero-eyebrow">HireFlow Resources</span>
          <h1 className="res-hero-title">
            Your guide to every career move
          </h1>
          <p className="res-hero-desc">
            Practical guidance for finding the right role, evaluating opportunities,
            preparing for interviews, and understanding the market.
          </p>
        </div>
      </section>

      {/* 2. Featured Resource Grid */}
      <section className="res-featured-section" aria-label="Featured resources">
        <div className="container">
          <div className="res-featured-grid">
            {FEATURED_GRID.map((item) => (
              <FeaturedCard key={item.slug} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Category Navigation */}
      <section className="res-cat-nav-section">
        <div className="container">
          <nav className="res-cat-tabs" aria-label="Resource categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`res-cat-tab${activeCategory === cat ? ' res-cat-tab--active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
                aria-pressed={activeCategory === cat}
              >
                {cat}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* 4. Resource Article Grid */}
      <section className="res-articles-section" aria-label="Resource articles">
        <div className="container">
          <div className="res-articles-grid">
            {filteredArticles.map((article) => (
              <Link key={article.slug} to={`/resources/${article.slug}`} className="res-article-card">
                <div className="res-article-visual">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="res-article-img"
                    loading="lazy"
                  />
                </div>
                <div className="res-article-body">
                  <span className="res-article-cat">{article.category}</span>
                  <h3 className="res-article-title">{article.title}</h3>
                  <p className="res-article-desc">{article.description}</p>
                </div>
              </Link>
            ))}
            {filteredArticles.length === 0 && (
              <div className="res-articles-empty">
                <p>No resources found in this category yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Recent + Popular */}
      <section className="res-recent-section" aria-label="Recent and popular resources">
        <div className="container">
          <div className="res-recent-layout">
            <div className="res-recent-list">
              <span className="res-section-label">RECENT RESOURCES</span>
              {RECENT_RESOURCES.map((item) => (
                <Link key={item.slug} to={`/resources/${item.slug}`} className="res-recent-item">
                  <div className="res-recent-content">
                    <h3 className="res-recent-title">{item.title}</h3>
                    <p className="res-recent-desc">{item.description}</p>
                  </div>
                  <span className="res-recent-arrow"><ArrowIcon /></span>
                </Link>
              ))}
            </div>
            <aside className="res-popular-sidebar">
              <span className="res-section-label">POPULAR</span>
              <ol className="res-popular-list">
                {POPULAR_RESOURCES.map((item, i) => (
                  <li key={item.slug} className="res-popular-item">
                    <span className="res-popular-num">{String(i + 1).padStart(2, '0')}</span>
                    <Link to={`/resources/${item.slug}`} className="res-popular-link">
                      <span className="res-popular-text">{item.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </section>

      {/* 6. Expertise Areas */}
      <section className="res-expertise-section" aria-label="Resource expertise areas">
        <div className="container">
          <span className="res-section-label">RESOURCE FOCUS AREAS</span>
          <h2 className="res-expertise-title">What our resources cover</h2>
          <div className="res-expertise-grid">
            {EXPERTISE.map((item) => (
              <div key={item.title} className="res-expertise-card">
                <h3 className="res-expertise-name">{item.title}</h3>
                <p className="res-expertise-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Newsletter / CTA */}
      <section className="res-newsletter" aria-label="Newsletter subscription">
        <div className="container">
          <div className="res-newsletter-inner">
            <div className="res-newsletter-content">
              <h2 className="res-newsletter-title">
                Stay ahead of your next career move.
              </h2>
              <p className="res-newsletter-desc">
                Get useful career guidance, job-search insights, and market updates from HireFlow.
              </p>
            </div>
            {newsletterState === 'success' ? (
              <div className="res-newsletter-success" role="status">
                <div className="res-newsletter-success-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="res-newsletter-success-text">
                  You are subscribed. We will keep you posted.
                </p>
              </div>
            ) : (
              <form className="res-newsletter-form" onSubmit={handleNewsletterSubmit} noValidate>
                <div className="res-newsletter-field">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className={`res-newsletter-input${newsletterState === 'error' ? ' res-newsletter-input--error' : ''}`}
                    aria-label="Email address"
                    aria-invalid={newsletterState === 'error'}
                    aria-describedby={newsletterState === 'error' ? 'newsletter-error' : undefined}
                    value={newsletterEmail}
                    onChange={(e) => {
                      setNewsletterEmail(e.target.value);
                      if (newsletterState === 'error') setNewsletterState('idle');
                    }}
                    disabled={newsletterSubmitting}
                  />
                  {newsletterState === 'error' && (
                    <span className="res-newsletter-error" id="newsletter-error" role="alert">
                      {newsletterError}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className="res-newsletter-btn"
                  disabled={newsletterSubmitting}
                >
                  {newsletterSubmitting ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

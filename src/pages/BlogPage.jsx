import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import './BlogPage.css';

const POSTS = [
  {
    category: 'Job Market',
    title: 'The state of remote hiring in 2026',
    description: 'Remote work continues to reshape how companies hire — from fully distributed teams to flexible hybrid schedules.',
    image: '/resources/remote-work.jpg',
  },
  {
    category: 'Career Advice',
    title: '5 skills every product manager needs',
    description: 'From data literacy to stakeholder management, these are the competencies hiring managers look for most.',
    image: '/resources/in-demand-skills.jpg',
  },
  {
    category: 'Hiring',
    title: 'Building inclusive job descriptions',
    description: 'Small changes in language can significantly increase the diversity of your applicant pool. Here is what works.',
    image: '/resources/personal-brand.jpg',
  },
  {
    category: 'Compensation',
    title: 'Salary negotiation myths debunked',
    description: 'Compensation conversations are full of myths. Here is how to separate fact from fiction and negotiate with confidence.',
    image: '/resources/salary-negotiate.jpg',
  },
  {
    category: 'Hiring',
    title: 'How to evaluate a startup offer',
    description: 'Beyond salary: equity, growth potential, culture, and the questions you should ask before signing.',
    image: '/resources/career-pivot.jpg',
  },
  {
    category: 'Job Market',
    title: 'The rise of skills-based hiring',
    description: 'Why more companies are dropping degree requirements and how it changes the talent landscape.',
    image: '/resources/job-market-skills.jpg',
  },
];

const CATEGORIES = ['All', 'Career Advice', 'Hiring', 'Compensation', 'Job Market'];

const FEATURED = POSTS[0];
const GRID_POSTS = POSTS.slice(1);

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredGrid = activeCategory === 'All'
    ? GRID_POSTS
    : GRID_POSTS.filter(p => p.category === activeCategory);

  return (
    <div className="blog-page">
      {/* ── HERO ── */}
      <section className="blog-hero">
        <div className="blog-hero-glow" aria-hidden="true" />
        <div className="blog-hero-glow blog-hero-glow--secondary" aria-hidden="true" />
        <div className="container blog-hero-layout">
          <div className="blog-hero-content">
            <span className="blog-hero-eyebrow">Insights</span>
            <h1 className="blog-hero-title">Ideas for your next career move.</h1>
            <p className="blog-hero-desc">Stories, guides, and hiring insights from the HireFlow team.</p>
          </div>
        </div>
      </section>

      {/* ── FEATURED ── */}
      <section className="blog-featured">
        <div className="container">
          <Reveal>
            <div className="blog-featured-card">
              <div className="blog-featured-image" style={{ backgroundImage: `url(${FEATURED.image})` }} role="img" aria-label={FEATURED.title} />
              <div className="blog-featured-content">
                <span className="blog-card-category">{FEATURED.category}</span>
                <h2 className="blog-featured-title">{FEATURED.title}</h2>
                <p className="blog-featured-desc">{FEATURED.description}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="blog-categories">
        <div className="container">
          <nav className="blog-category-strip" aria-label="Article categories">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`blog-category-btn${activeCategory === cat ? ' blog-category-btn--active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* ── GRID ── */}
      <section className="blog-grid">
        <div className="container">
          <Reveal>
            <h2 className="blog-section-heading">Latest articles</h2>
          </Reveal>
          {filteredGrid.length > 0 ? (
            <div className="blog-grid-layout">
{filteredGrid.map((post, i) => (
                <Reveal key={post.title} delay={100 + i * 80}>
                  <article className="blog-card">
                    <div className="blog-card-image" style={{ backgroundImage: `url(${post.image})` }} role="img" aria-label={post.title} />
                    <div className="blog-card-content">
                      <span className="blog-card-category">{post.category}</span>
                      <h3 className="blog-card-title">{post.title}</h3>
                      <p className="blog-card-desc">{post.description}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="blog-empty-state">No articles in this category yet.</p>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="blog-cta">
        <div className="blog-cta-glow" aria-hidden="true" />
        <div className="container blog-cta-inner">
          <Reveal>
            <h2 className="blog-cta-heading">Ready to put what you learned into practice?</h2>
            <p className="blog-cta-desc">Find roles that match your skills and goals.</p>
            <Link to="/" className="btn btn-primary btn-lg">Find a job</Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import './SolutionsPage.css';

const SEGMENTS = [
  {
    id: 1,
    title: 'Startups',
    description: 'Post your first role in minutes. Reach candidates who are excited about early-stage opportunities and equity.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
  },
  {
    id: 2,
    title: 'Scale-ups',
    description: 'Manage multiple openings, coordinate hiring managers, and track applicants across roles with our pipeline tools.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    id: 3,
    title: 'Enterprise',
    description: 'Custom integrations, dedicated support, and employer branding features for large-scale hiring programs.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
      </svg>
    ),
  },
];

const REASONS = [
  'Qualified candidate pool across engineering, design, product, marketing, and operations.',
  'Transparent pricing with no hidden fees or long-term contracts.',
  'Built-in applicant tracking so you never lose track of a promising candidate.',
  'Company profile pages that showcase your culture and attract the right fit.',
  'Analytics to understand what is working and optimize your hiring process.',
];

export default function SolutionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect jobseekers away from recruiter-only Solutions page.
  useEffect(() => {
    if (!authLoading && user && user.role === 'jobseeker') {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return <div className="app-loading" aria-busy="true" />;
  }

  return (
    <div className="solutions-page">
      {/* ── HERO ── */}
      <section className="sol-hero">
        <div className="sol-hero-glow" aria-hidden="true" />
        <div className="sol-hero-glow sol-hero-glow--secondary" aria-hidden="true" />
        <div className="container sol-hero-layout">
          <div className="sol-hero-content">
            <Reveal>
              <span className="sol-hero-eyebrow">How HireFlow helps</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="sol-hero-title">Solutions</h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="sol-hero-desc">
                Learn how HireFlow powers hiring for companies of every size — from first job posting to building an entire team.
              </p>
            </Reveal>
          </div>
          <Reveal delay={240} className="sol-hero-visual">
            <div className="sol-hero-visual-card">
              <span className="sol-hero-visual-label">Solutions</span>
              <div className="sol-hero-visual-count">{SEGMENTS.length}</div>
              <span className="sol-hero-visual-desc">Solutions for growing teams</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SEGMENTS ── */}
      <section className="sol-segments">
        <div className="container">
          <Reveal>
            <span className="sol-section-eyebrow">Built for every team</span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="sol-segments-heading">Choose the solution that fits your stage.</h2>
          </Reveal>

          {/* Primary segment — large block */}
          <Reveal delay={100}>
            <div className="sol-segment-primary">
              <div className="sol-segment-primary-icon">{SEGMENTS[0].icon}</div>
              <div className="sol-segment-primary-content">
                <h3 className="sol-segment-primary-title">{SEGMENTS[0].title}</h3>
                <p className="sol-segment-primary-desc">{SEGMENTS[0].description}</p>
              </div>
            </div>
          </Reveal>

          {/* Supporting segments — 2-column grid */}
          <div className="sol-segments-grid">
            {SEGMENTS.slice(1).map((segment, i) => (
              <Reveal key={segment.id} delay={120 + i * 80}>
                <div className="sol-segment-card">
                  <div className="sol-segment-icon">{segment.icon}</div>
                  <h3 className="sol-segment-title">{segment.title}</h3>
                  <p className="sol-segment-desc">{segment.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY HIREFLOW ── */}
      <section className="sol-why">
        <div className="container">
          <Reveal>
            <span className="sol-section-eyebrow">Why HireFlow</span>
          </Reveal>
          <div className="sol-why-layout">
            <Reveal delay={80}>
              <div className="sol-why-heading-area">
                <h2 className="sol-why-heading">Why companies choose HireFlow</h2>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <ol className="sol-why-list">
                {REASONS.map((reason, i) => (
                  <li key={i} className="sol-why-item">
                    <span className="sol-why-marker">{String(i + 1).padStart(2, '0')}</span>
                    <p className="sol-why-text">{reason}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="sol-cta">
        <div className="sol-cta-glow" aria-hidden="true" />
        <div className="container sol-cta-inner">
          <Reveal>
            <h2 className="sol-cta-heading">Get started today.</h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="sol-cta-desc">
              Join thousands of companies already using HireFlow to find and hire great people.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <Link to="/register" className="btn btn-primary btn-lg">
              Get started today
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import './TalentSearchPage.css';

const FEATURES = [
  {
    id: 1,
    title: 'Advanced filters',
    description: 'Search by skills, experience level, work type, salary expectations, and location to find your ideal candidate.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: 2,
    title: 'Candidate insights',
    description: 'Review detailed profiles, work history, and skill assessments before reaching out.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 3,
    title: 'Direct messaging',
    description: 'Connect with candidates through our built-in messaging system. No need to share personal contact info.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 4,
    title: 'Hiring analytics',
    description: 'Track pipeline metrics, time-to-hire, and source effectiveness from your dashboard.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
      </svg>
    ),
  },
];

const PRIMARY_FEATURE = FEATURES[0];
const SECONDARY_FEATURES = FEATURES.slice(1);

export default function TalentSearchPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect jobseekers away from recruiter-only Talent Search.
  useEffect(() => {
    if (!authLoading && user && user.role === 'jobseeker') {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return <div className="app-loading" aria-busy="true" />;
  }

  return (
    <div className="talent-search-page">
      {/* ── HERO ── */}
      <section className="ts-hero">
        <div className="ts-hero-glow" aria-hidden="true" />
        <div className="ts-hero-glow ts-hero-glow--secondary" aria-hidden="true" />
        <div className="container ts-hero-layout">
          <div className="ts-hero-content">
            <span className="ts-hero-eyebrow">For employers</span>
            <h1 className="ts-hero-title">Talent Search</h1>
            <p className="ts-hero-desc">
              Find and connect with qualified candidates across engineering, design, product, and more.
            </p>
          </div>
          <div className="ts-hero-visual">
            <div className="ts-hero-visual-card">
              <span className="ts-hero-visual-label">Talent Search</span>
              <div className="ts-hero-visual-count">{FEATURES.length}</div>
              <span className="ts-hero-visual-desc">Tools for finding candidates</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="ts-features">
        <div className="container">
          <Reveal>
            <div className="section-intro">
              <h2 className="ts-features-heading">What you get</h2>
            </div>
          </Reveal>

          {/* Primary feature — large block */}
          <Reveal delay={100}>
            <div className="ts-feature-primary">
              <div className="ts-feature-primary-icon">{PRIMARY_FEATURE.icon}</div>
              <h3 className="ts-feature-primary-title">{PRIMARY_FEATURE.title}</h3>
              <p className="ts-feature-primary-desc">{PRIMARY_FEATURE.description}</p>
            </div>
          </Reveal>

          {/* Secondary features — 2x2 grid */}
          <div className="ts-features-grid">
            {SECONDARY_FEATURES.map((feature, i) => (
              <Reveal key={feature.id} delay={120 + i * 80}>
                <div className="ts-feature-card">
                  <div className="ts-feature-icon">{feature.icon}</div>
                  <h3 className="ts-feature-title">{feature.title}</h3>
                  <p className="ts-feature-desc">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="ts-how">
        <div className="container">
          <Reveal>
            <div className="section-intro">
              <h2 className="ts-how-heading">How Talent Search works</h2>
              <p className="ts-how-body">
                Post a job or search our candidate database directly. Our matching algorithm surfaces the most relevant profiles based on skills, experience, and preferences. Reach out to top candidates and manage your entire hiring pipeline in one place.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ts-cta">
        <div className="ts-cta-glow" aria-hidden="true" />
        <div className="container ts-cta-inner">
          <Reveal>
            <h2 className="ts-cta-heading">Start building your team.</h2>
            <p className="ts-cta-desc">
              Post your first job and start connecting with qualified candidates today.
            </p>
            <Link to="/profile?tab=post" className="btn btn-primary btn-lg">
              Post your first job
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

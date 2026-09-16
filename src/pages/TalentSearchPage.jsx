import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import './TalentSearchPage.css';

const FEATURES = [
  {
    id: 1,
    title: 'Applicant review',
    description: 'Review applicant profiles, resumes, and cover letters for your posted jobs all in one place.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: 2,
    title: 'Candidate insights',
    description: 'View detailed applicant profiles, work history, and submitted materials after they apply.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 3,
    title: 'Applicant pipelines',
    description: 'Move candidates through review, interview, and offer stages all from your recruiting dashboard.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
      </svg>
    ),
  },
  {
    id: 4,
    title: 'Hiring analytics',
    description: 'Track pipeline metrics and application progress from your dashboard.',
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

          {/* Primary feature - large block */}
          <Reveal delay={100}>
            <div className="ts-feature-primary">
              <div className="ts-feature-primary-icon">{PRIMARY_FEATURE.icon}</div>
              <h3 className="ts-feature-primary-title">{PRIMARY_FEATURE.title}</h3>
              <p className="ts-feature-primary-desc">{PRIMARY_FEATURE.description}</p>
            </div>
          </Reveal>

          {/* Secondary features - 2x2 grid */}
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
                Post a job and start receiving applications right away. Review applicant profiles,
                and manage everyone through your hiring pipeline from one dashboard.
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

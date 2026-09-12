import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import './PricingPage.css';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything you need to start your job search.',
    features: ['Unlimited job browsing', 'Save up to 10 jobs', 'Create your profile', 'Apply to unlimited jobs', 'Basic salary insights'],
    cta: { label: 'Get started', to: '/register' },
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: 'per month',
    description: 'Advanced tools for serious job seekers.',
    features: ['Everything in Free', 'Unlimited saved jobs', 'Application tracking', 'Priority support', 'Salary negotiation guides', 'Profile visibility boost'],
    cta: { label: 'Start free trial', to: '/register' },
    highlighted: true,
  },
  {
    name: 'Employer',
    price: '$199',
    period: 'per posting',
    description: 'Reach top talent with a single job post.',
    features: ['30-day listing', 'Featured placement', 'Applicant management', 'Company profile page', 'Analytics dashboard', 'Email support'],
    highlighted: false,
  },
];

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function PricingPage() {
  const { user, toggleRole } = useAuth();

  const handleSwitchToRecruiter = async () => {
    try {
      await toggleRole('recruiter');
      window.location.reload();
    } catch {
      // role unchanged on failure
    }
  };

  return (
    <div className="pricing-page">
      {/* ── HERO ── */}
      <section className="pricing-hero">
        <div className="pricing-hero-glow" aria-hidden="true" />
        <div className="pricing-hero-glow pricing-hero-glow--secondary" aria-hidden="true" />
        <div className="container pricing-hero-layout">
          <div className="pricing-hero-content">
            <span className="pricing-hero-eyebrow">For every team</span>
            <h1 className="pricing-hero-title">Simple, transparent pricing</h1>
            <p className="pricing-hero-desc">
              Simple, transparent pricing for jobseekers and employers. Posting a job and applying are free to get started.
            </p>
          </div>
          <div className="pricing-hero-visual">
            <div className="pricing-hero-visual-card">
              <span className="pricing-hero-visual-label">Get started</span>
              <div className="pricing-hero-visual-price">$0</div>
              <span className="pricing-hero-visual-desc">Free to begin</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTEXT ── */}
      <section className="pricing-context">
        <div className="container">
          <Reveal>
            <p className="pricing-context-text">
              Whether you are exploring your first role or hiring for your entire team, HireFlow has a plan that fits. Start with our free tier and upgrade when you need more.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── PRICING TIERS ── */}
      <section className="pricing-tiers">
        <div className="container">
          <Reveal>
            <div className="section-intro">
              <h2 className="pricing-tiers-heading">Choose your plan</h2>
            </div>
          </Reveal>
          <div className="pricing-tiers-grid">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={100 + i * 80}>
                <div className={`pricing-card ${tier.highlighted ? 'pricing-card--highlighted' : ''}`}>
                  {tier.highlighted && (
                    <span className="pricing-card-badge">Most popular</span>
                  )}
                  <h3 className="pricing-card-name">{tier.name}</h3>
                  <div className="pricing-card-price">
                    <span className="pricing-card-amount">{tier.price}</span>
                    <span className="pricing-card-period">/{tier.period}</span>
                  </div>
                  <p className="pricing-card-desc">{tier.description}</p>
                  <ul className="pricing-card-features">
                    {tier.features.map((feature, j) => (
                      <li key={j}>
                        <CheckIcon />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {tier.name === 'Employer' ? (
                    user?.role === 'recruiter' ? (
                      <Link
                        to="/profile?tab=post"
                        className={`btn btn-secondary btn-lg pricing-card-cta`}
                      >
                        Post a job
                      </Link>
                    ) : user?.role === 'jobseeker' ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-lg pricing-card-cta"
                        onClick={handleSwitchToRecruiter}
                      >
                        Switch to Recruiter
                      </button>
                    ) : (
                      <Link
                        to="/register"
                        className={`btn btn-secondary btn-lg pricing-card-cta`}
                      >
                        Get started
                      </Link>
                    )
                  ) : (
                    <Link
                      to={tier.cta.to}
                      className={`btn ${tier.highlighted ? 'btn-primary' : 'btn-secondary'} btn-lg pricing-card-cta`}
                    >
                      {tier.cta.label}
                    </Link>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pricing-cta">
        <div className="pricing-cta-glow" aria-hidden="true" />
        <div className="container pricing-cta-inner">
          <Reveal>
            <h2 className="pricing-cta-heading">Start building your team today.</h2>
            <p className="pricing-cta-desc">
              Join thousands of companies already using HireFlow to find and hire great people.
            </p>
            <Link to="/register" className="btn btn-primary btn-lg">
              Get started
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

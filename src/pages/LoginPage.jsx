import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthCarousel from '../components/AuthCarousel';
import { PEOPLE_ICON, TRACK_ICON, SHIELD_ICON, ZAP_ICON } from '../constants/authIcons';
import './LoginPage.css';

/* ---------- Carousel slide data ---------- */
const LOGIN_SLIDES = [
  {
    id: 'hiring',
    badge: 'Hiring made simple',
    badgeIcon: PEOPLE_ICON,
    title: 'The smarter way to connect talent with opportunity',
    subtitle:
      'HireFlow brings candidates, employers, and recruiters into one polished workspace — so the right people find each other, faster.',
  },
  {
    id: 'track',
    badge: 'Real-time updates',
    badgeIcon: TRACK_ICON,
    title: 'Track every application in one place',
    subtitle:
      'From submitted to interviewed — get live status updates and never lose track of an opportunity again.',
  },
  {
    id: 'secure',
    badge: 'Privacy-first',
    badgeIcon: SHIELD_ICON,
    title: 'Your data stays yours',
    subtitle:
      "We only share what you choose to share. Your profile, resume, and communications are encrypted and under your control.",
  },
  {
    id: 'fast',
    badge: 'Lightning fast',
    badgeIcon: ZAP_ICON,
    title: 'From search to applied in seconds',
    subtitle:
      'One-click apply, smart suggestions, and personalized dashboards mean less time applying and more time interviewing.',
  },
];

/**
 * LoginPage
 *
 * Polished, two-column authentication screen for HireFlow.
 * - Left:  email + password sign-in form
 * - Right: HireFlow branding / product story panel
 *
 * Behavior:
 * - Calls `login(email, password)` from AuthContext on submit.
 * - On success, navigates to "/".
 * - On failure, displays the normalized API error message.
 * - Prevents duplicate submissions while the request is in flight.
 * - Already-authenticated users are redirected to "/" on mount.
 */
export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If the user is already signed in, bounce them to the homepage.
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // guard against duplicate submits

    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      // api.js normalizes server errors into Error objects
      // with .message derived from the backend's `error` field.
      setError(err?.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell" role="region" aria-label="Sign in to HireFlow">
        {/* ---------- LEFT: Sign-in form ---------- */}
        <section className="auth-form-pane" aria-labelledby="auth-form-title">
          <a href="/" className="auth-brand" aria-label="HireFlow home">
            <svg
              className="auth-brand-icon"
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="8" fill="var(--color-brand-primary)" />
              <path d="M9 11h14v2.5H9zm0 5h10v2.5H9zm0 5h12v2.5H9z" fill="white" />
            </svg>
            <span className="auth-brand-text">HireFlow</span>
          </a>

          <div className="auth-form-inner">
            <header className="auth-form-header">
              <h1 id="auth-form-title" className="auth-title">Welcome back</h1>
              <p className="auth-subtitle">
                Sign in to your HireFlow account to continue your job search or hiring workflow.
              </p>
            </header>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <div
                  className="auth-alert auth-alert-error"
                  role="alert"
                  aria-live="assertive"
                  data-testid="login-error"
                >
                  <svg
                    className="auth-alert-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="login-email" className="auth-label">
                  Email address <span className="auth-required" aria-hidden="true">*</span>
                </label>
                <div className="auth-input-wrap">
                  <svg
                    className="auth-input-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="auth-input"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="login-password" className="auth-label">
                  Password <span className="auth-required" aria-hidden="true">*</span>
                </label>
                <div className="auth-input-wrap">
                  <svg
                    className="auth-input-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="auth-input"
                    disabled={submitting}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <svg
                      className="auth-spinner"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        opacity="0.25"
                      />
                      <path
                        d="M22 12a10 10 0 0 1-10 10"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              <p className="auth-switch">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="auth-link">
                  Create one
                </Link>
              </p>
            </form>
          </div>

          <p className="auth-footnote">
            <span>© {new Date().getFullYear()} HireFlow</span>
            <span aria-hidden="true">·</span>
            <a href="#" className="auth-footnote-link">Terms</a>
            <span aria-hidden="true">·</span>
            <a href="#" className="auth-footnote-link">Privacy</a>
          </p>
        </section>

        {/* ---------- RIGHT: HireFlow branding / product story carousel ---------- */}
        <aside className="auth-visual-pane">
          <AuthCarousel slides={LOGIN_SLIDES} />
        </aside>
      </div>
    </div>
  );
}

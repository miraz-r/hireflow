import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

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

        {/* ---------- RIGHT: HireFlow branding / visual panel ---------- */}
        <aside className="auth-visual-pane" aria-hidden="true">
          <div className="auth-visual-grid" />
          <div className="auth-visual-glow auth-visual-glow--top" />
          <div className="auth-visual-glow auth-visual-glow--bottom" />

          {/* Decorative floating "job card" mockups - pure CSS */}
          <div className="auth-mock auth-mock--back">
            <div className="auth-mock-header">
              <div className="auth-mock-avatar auth-mock-avatar--indigo" />
              <div className="auth-mock-lines">
                <span className="auth-mock-line auth-mock-line--lg" />
                <span className="auth-mock-line auth-mock-line--sm" />
              </div>
            </div>
            <div className="auth-mock-tags">
              <span className="auth-mock-tag" />
              <span className="auth-mock-tag auth-mock-tag--short" />
              <span className="auth-mock-tag" />
            </div>
            <div className="auth-mock-bar">
              <span className="auth-mock-bar-fill auth-mock-bar-fill--teal" />
            </div>
          </div>

          <div className="auth-mock auth-mock--front">
            <div className="auth-mock-header">
              <div className="auth-mock-avatar auth-mock-avatar--teal" />
              <div className="auth-mock-lines">
                <span className="auth-mock-line auth-mock-line--lg" />
                <span className="auth-mock-line auth-mock-line--md" />
              </div>
              <span className="auth-mock-badge">New</span>
            </div>
            <div className="auth-mock-meta">
              <span className="auth-mock-meta-item" />
              <span className="auth-mock-meta-item auth-mock-meta-item--short" />
            </div>
            <div className="auth-mock-tags">
              <span className="auth-mock-tag" />
              <span className="auth-mock-tag auth-mock-tag--short" />
            </div>
            <div className="auth-mock-bar">
              <span className="auth-mock-bar-fill auth-mock-bar-fill--indigo" />
            </div>
          </div>

          <div className="auth-visual-content">
            <div className="auth-visual-badge">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Hiring made simple</span>
            </div>
            <h2 className="auth-visual-title">
              The smarter way to connect talent with opportunity
            </h2>
            <p className="auth-visual-subtitle">
              HireFlow brings candidates, employers, and recruiters into one polished workspace
              {'—'} so the right people find each other, faster.
            </p>
          </div>

          {/* Pager-style dots (purely decorative) */}
          <div className="auth-visual-pager" aria-hidden="true">
            <span className="auth-pager-dot auth-pager-dot--active" />
            <span className="auth-pager-dot" />
            <span className="auth-pager-dot" />
            <span className="auth-pager-dot" />
            <span className="auth-pager-dot" />
          </div>
        </aside>
      </div>
    </div>
  );
}

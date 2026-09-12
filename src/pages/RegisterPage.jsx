import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthCarousel from '../components/AuthCarousel';
import { PEOPLE_ICON, TRACK_ICON, SHIELD_ICON, ZAP_ICON } from '../constants/authIcons';
import './RegisterPage.css';

/* ---------- Carousel slide data ---------- */
const REGISTER_SLIDES = [
  {
    id: 'join',
    badge: 'Join the network',
    badgeIcon: PEOPLE_ICON,
    title: 'Build your future with a workspace built for hiring',
    subtitle:
      "Create a free HireFlow account in seconds — whether you're looking for work or searching for your next great hire.",
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
 * RegisterPage
 *
 * Two-column registration screen for HireFlow.
 * - Left:  Full Name, Email, Phone, Password, Role form
 * - Right: HireFlow branding / product story panel (mirrors LoginPage)
 *
 * Behavior:
 * - Calls `register(email, password, role, fullName, phone)` from AuthContext.
 * - On success, navigates to "/login" so the user can sign in with their new account.
 * - On failure, displays the normalized API error message.
 * - Prevents duplicate submissions while the request is in flight.
 * - Already-authenticated users are redirected to "/" on mount.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9()\-\s]{6,32}$/;

const REGISTER_FIELD_IDS = [
  ['fullName', 'register-name'],
  ['email', 'register-email'],
  ['phone', 'register-phone'],
  ['password', 'register-password'],
];

function validateRegister({ fullName, email, phone, password }) {
  const errors = {};
  const name = fullName.trim();
  if (!name) {
    errors.fullName = 'Full name is required.';
  } else if (name.length > 120) {
    errors.fullName = 'Full name must be 1-120 characters.';
  }
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!phone.trim()) {
    errors.phone = 'Phone is required.';
  } else if (!PHONE_RE.test(phone.trim())) {
    errors.phone = 'Invalid phone format.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (!/[A-Za-z]/.test(password)) {
    errors.password = 'Password must contain at least one letter.';
  } else if (!/\d/.test(password)) {
    errors.password = 'Password must contain at least one number.';
  }
  return errors;
}

function focusFirstError(errors, fieldIds) {
  const first = fieldIds.find(([name]) => Boolean(errors[name]));
  if (!first) return;
  const el = document.getElementById(first[1]);
  if (el) el.focus();
}

export default function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If the user is already signed in, bounce them to the homepage.
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Lightweight client-side password hint (the server is the source of truth).
  const passwordHint = (() => {
    if (!password) return null;
    if (password.length < 8) return { tone: 'weak', text: 'At least 8 characters recommended' };
    if (password.length < 12) return { tone: 'ok', text: 'Looks good' };
    return { tone: 'strong', text: 'Strong password' };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // guard against duplicate submits

    setError('');

    const errors = validateRegister({ fullName, email, phone, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors, REGISTER_FIELD_IDS);
      return; // block the API call until required fields are valid
    }

    setSubmitting(true);
    try {
      await register(email.trim(), password, fullName.trim(), phone.trim());
      // Registration succeeded — direct the user to sign in.
      navigate('/login', { replace: true });
    } catch (err) {
      // api.js normalizes server errors into Error objects
      // with .message derived from the backend's `error` field.
      // If the backend sent a more specific message via validation,
      // .data?.error also carries it.
      setError(err?.message || 'Unable to create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFullNameChange = (e) => {
    setFullName(e.target.value);
    if (fieldErrors.fullName) {
      setFieldErrors((prev) => ({ ...prev, fullName: '' }));
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handlePhoneChange = (e) => {
    setPhone(e.target.value);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: '' }));
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: '' }));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell" role="region" aria-label="Create your HireFlow account">
        {/* ---------- LEFT: Registration form ---------- */}
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
              <h1 id="auth-form-title" className="auth-title">Create your account</h1>
              <p className="auth-subtitle">Create your HireFlow account.</p>
            </header>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <div
                  className="auth-alert auth-alert-error"
                  role="alert"
                  aria-live="assertive"
                  data-testid="register-error"
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

              {/* Full Name */}
              <div className="auth-field">
                <label htmlFor="register-name" className="auth-label">
                  Full name <span className="auth-required" aria-hidden="true">*</span>
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="register-name"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={handleFullNameChange}
                    placeholder="Jane Doe"
                    className={`auth-input${fieldErrors.fullName ? ' input-error' : ''}`}
                    aria-invalid={fieldErrors.fullName ? true : undefined}
                    aria-describedby={fieldErrors.fullName ? 'register-name-error' : undefined}
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.fullName && (
                  <span id="register-name-error" className="auth-field-error" role="alert">
                    {fieldErrors.fullName}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="auth-field">
                <label htmlFor="register-email" className="auth-label">
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
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@company.com"
                    className={`auth-input${fieldErrors.email ? ' input-error' : ''}`}
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.email && (
                  <span id="register-email-error" className="auth-field-error" role="alert">
                    {fieldErrors.email}
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="auth-field">
                <label htmlFor="register-phone" className="auth-label">
                  Phone <span className="auth-required" aria-hidden="true">*</span>
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
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <input
                    id="register-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    required
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="+1 555 123 4567"
                    className={`auth-input${fieldErrors.phone ? ' input-error' : ''}`}
                    aria-invalid={fieldErrors.phone ? true : undefined}
                    aria-describedby={fieldErrors.phone ? 'register-phone-error' : undefined}
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.phone && (
                  <span id="register-phone-error" className="auth-field-error" role="alert">
                    {fieldErrors.phone}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="auth-field">
                <label htmlFor="register-password" className="auth-label">
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
                    id="register-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="Create a strong password"
                    className={`auth-input${fieldErrors.password ? ' input-error' : ''}`}
                    aria-invalid={fieldErrors.password ? true : undefined}
                    aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
                    disabled={submitting}
                  />
                </div>
                {!fieldErrors.password && passwordHint && (
                  <span className={`auth-hint auth-hint--${passwordHint.tone}`}>
                    {passwordHint.text}
                  </span>
                )}
                {fieldErrors.password && (
                  <span id="register-password-error" className="auth-field-error" role="alert">
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Role: everyone starts as a jobseeker; toggle to recruiter later from your profile. */}

              <button
                type="submit"
                className="btn btn-primary btn-lg auth-submit"
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
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span>Creating account…</span>
                  </>
                ) : (
                  <span>Create account</span>
                )}
              </button>

              <p className="auth-switch">
                Already have an account?{' '}
                <Link to="/login" className="auth-link">
                  Sign in
                </Link>
              </p>
            </form>
          </div>

          <p className="auth-footnote">
            <span>© {new Date().getFullYear()} HireFlow</span>
            <span aria-hidden="true">·</span>
            <Link to="/terms" className="auth-footnote-link">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link to="/privacy" className="auth-footnote-link">Privacy</Link>
          </p>
        </section>

        {/* ---------- RIGHT: HireFlow branding / product story carousel ---------- */}
        <aside className="auth-visual-pane">
          <AuthCarousel slides={REGISTER_SLIDES} />
        </aside>
      </div>
    </div>
  );
}

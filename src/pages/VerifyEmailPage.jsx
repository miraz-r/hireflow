import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyEmailChange } from '../utils/emailChangeApi';
import './VerifyEmailPage.css';

const IDLE_RESULT = { done: false, ok: false, signInRequired: false, error: '' };

const CHECK_ICON = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ALERT_ICON = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const LOCK_ICON = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

function SignInRequiredCard() {
  return (
    <div className="verify-page">
      <div className="verify-card" role="alert">
        <div className="verify-icon verify-icon--info">{LOCK_ICON}</div>
        <h1 className="verify-title">Sign in required</h1>
        <p className="verify-desc">
          Sign in to your HireFlow account before verifying your new email address.
        </p>
        <div className="verify-actions">
          <Link to="/login" className="btn btn-primary">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [result, setResult] = useState(IDLE_RESULT);
  const verifyRequested = useRef(false);

  useEffect(() => {
    if (authLoading || !token || !user || verifyRequested.current) return;
    verifyRequested.current = true;

    verifyEmailChange(token)
      .then(() => refreshUser().catch(() => {}))
      .then(() => setResult({ done: true, ok: true, signInRequired: false, error: '' }))
      .catch((err) => {
        const status = err?.status;
        if (status === 401) {
          setResult({ done: true, ok: false, signInRequired: true, error: '' });
        } else if (status === 409) {
          setResult({ done: true, ok: false, signInRequired: false, error: 'This email address is no longer available.' });
        } else if (status === 400) {
          setResult({ done: true, ok: false, signInRequired: false, error: 'This verification link is invalid, expired, or has already been used.' });
        } else {
          setResult({ done: true, ok: false, signInRequired: false, error: 'We could not verify your email right now. Please try again or request a new link from your profile.' });
        }
      });
  }, [authLoading, token, user, refreshUser]);

  if (authLoading) {
    return (
      <div className="verify-page">
        <div className="verify-card" role="status">
          <div className="verify-icon"><span className="verify-spinner" aria-hidden="true" /></div>
          <h1 className="verify-title">Preparing…</h1>
          <p className="verify-desc">Just a moment while we get things ready.</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="verify-page">
        <div className="verify-card" role="alert">
          <div className="verify-icon verify-icon--error">{ALERT_ICON}</div>
          <h1 className="verify-title">Invalid verification link</h1>
          <p className="verify-desc">
            This link is missing the verification details. Use the link from your
            verification email, or request a new one from your profile.
          </p>
          <div className="verify-actions">
            <Link to="/profile" className="btn btn-primary">Go to Profile</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInRequiredCard />;
  }

  if (!result.done) {
    return (
      <div className="verify-page">
        <div className="verify-card" role="status">
          <div className="verify-icon"><span className="verify-spinner" aria-hidden="true" /></div>
          <h1 className="verify-title">Verifying your email…</h1>
          <p className="verify-desc">This only takes a moment.</p>
        </div>
      </div>
    );
  }

  if (result.signInRequired) {
    return <SignInRequiredCard />;
  }

  if (result.ok) {
    return (
      <div className="verify-page">
        <div className="verify-card" role="status">
          <div className="verify-icon verify-icon--success">{CHECK_ICON}</div>
          <h1 className="verify-title">Email verified</h1>
          <p className="verify-desc">
            Your account email is now <strong>{user.email}</strong>. You&apos;re all set.
          </p>
          <div className="verify-actions">
            <Link to="/profile" className="btn btn-primary">Go to Profile</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-page">
      <div className="verify-card" role="alert">
        <div className="verify-icon verify-icon--error">{ALERT_ICON}</div>
        <h1 className="verify-title">Email change not confirmed</h1>
        <p className="verify-desc">{result.error}</p>
        <div className="verify-actions">
          <Link to="/profile" className="btn btn-primary">Go to Profile</Link>
        </div>
      </div>
    </div>
  );
}
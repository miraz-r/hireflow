import { useState, useCallback, useEffect } from 'react';
import {
  requestEmailChange,
  resendEmailChange,
  cancelEmailChange,
  getPendingEmailChange,
} from '../utils/emailChangeApi';
import Toast from './Toast';
import './EmailField.css';

/**
 * EmailField - change the account email with verification, any role.
 *
 * The account email stays as the CURRENT verified address until the user
 * verifies the pending change (the backend keeps it that way). Default shows
 * the current email inline with a Verified badge + Change action, clicking
 * Change transforms that same field into an inline edit form, and the pending
 * confirmation stays attached to the same field (survives refresh because it
 * is fetched fresh from GET /email-change, not stored in the browser).
 *
 * Extracted verbatim from the previous ProfilePage implementation so
 * recruiter/jobseeker behavior stays identical.
 */
export default function EmailField({ currentEmail, onEmailChanged }) {
  const [pending, setPending] = useState(null);   // { newEmail, expiresAt } | null
  const [pendingLoading, setPendingLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [toast, setToast] = useState(null);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res = await getPendingEmailChange();
      const data = res.data || (res && typeof res === 'object' ? res : null);
      setPending(
        data && data.pending
          ? { newEmail: data.newEmail || '', expiresAt: data.expiresAt || null }
          : null
      );
    } catch {
      setPending(null);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  // Keep the "Expires in …" readout accurate and drop the pending state once
  // the backend expiry passes (the backend remains the source of truth).
  useEffect(() => {
    if (!pending?.expiresAt) return undefined;
    const refresh = setInterval(() => {
      if (new Date(pending.expiresAt).getTime() <= Date.now()) {
        setPending(null);
        setOpen(false);
      } else {
        setNowTick(Date.now());
      }
    }, 30000);
    return () => clearInterval(refresh);
  }, [pending?.expiresAt]);

  const submitRequest = async () => {
    setFormError('');

    const value = newEmail.trim();
    if (!value) {
      setFieldError('Enter your new email address.');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setFieldError('Enter a valid email address (e.g. name@example.com).');
      return;
    }
    if (value.toLowerCase() === String(currentEmail || '').toLowerCase()) {
      setFieldError('New email must be different from your current email.');
      return;
    }
    setFieldError('');
    setSubmitting(true);
    try {
      await requestEmailChange(value);
      setNewEmail('');
      setOpen(false);
      setFormError('');
      showToast('Verification email sent.');
      await loadPending();
    } catch (err) {
      setFormError(err?.message || 'Could not request an email change.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (!submitting) submitRequest();
  };

  const handleResend = async () => {
    setFormError('');
    setResending(true);
    try {
      await resendEmailChange();
      showToast('Verification email sent.');
      await loadPending();
    } catch (err) {
      setFormError(err?.message || 'Could not resend the verification email.');
      await loadPending().catch(() => {});
    } finally {
      setResending(false);
    }
  };

  const openForm = () => {
    setOpen(true);
    setFieldError('');
    setFormError('');
  };

  const closeForm = () => {
    setOpen(false);
    setNewEmail('');
    setFieldError('');
    setFormError('');
  };

  const handleCancel = async () => {
    setFormError('');
    setCancelling(true);
    try {
      await cancelEmailChange();
      setPending(null);
      setOpen(false);
      setNewEmail('');
      showToast('Email change cancelled');
      onEmailChanged?.();
    } catch (err) {
      setFormError(err?.message || 'Could not cancel the email change.');
      await loadPending().catch(() => {});
    } finally {
      setCancelling(false);
    }
  };

  const busy = submitting || resending || cancelling;

  return (
    <div className="profile-field email-field">
      {pendingLoading ? (
        <>
          <span className="profile-label">Email <span aria-hidden="true">*</span></span>
          <div className="email-field-box">
            <span className="email-field-value">{currentEmail || 'Not set'}</span>
            <span className="email-field-loading" role="status">Checking…</span>
          </div>
        </>
      ) : open ? (
        // Edit state - the same Email field becomes an inline form: the
        // input and Cancel/Save stay inside the outlined field, helper text
        // stays underneath.
        <>
          <span className="profile-label">Email <span aria-hidden="true">*</span></span>
          <div className="email-field-box email-field-box--edit">
            <input
              id="account-email"
              name="newEmail"
              type="email"
              className="input email-field-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={handleEditKeyDown}
              placeholder="you@example.com"
              aria-label="New email address"
              autoComplete="email"
              disabled={submitting}
            />
            <div className="email-field-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={submitRequest} disabled={submitting}>
                {submitting ? 'Sending…' : 'Save'}
              </button>
            </div>
          </div>
          {fieldError && <span className="profile-field-error" role="alert">{fieldError}</span>}
          {formError && <div className="auth-alert auth-alert-error email-field-alert" role="alert"><span>{formError}</span></div>}
          <p className="email-field-note">We'll send a verification link to this address.</p>
        </>
      ) : pending ? (
        // Pending state - verification awaited, kept on the same Email field
        <>
          <span className="profile-label">Email <span aria-hidden="true">*</span></span>
          <div className="email-field-box">
            <span className="email-field-value">{pending.newEmail}</span>
            <span className="email-field-end">
              <span className="badge badge-warning email-field-badge">Verification required</span>
            </span>
          </div>
          <div className="email-field-subrow">
            <div className="email-field-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleResend} disabled={busy}>
                {resending ? 'Resending…' : 'Resend'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={openForm} disabled={busy}>
                Change
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={busy}>
                {cancelling ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
            <span className="email-field-expiry">Expires in {formatExpiresIn(pending.expiresAt, nowTick)}</span>
          </div>
          {formError && <div className="auth-alert auth-alert-error email-field-alert" role="alert"><span>{formError}</span></div>}
        </>
      ) : (
        // Default state - current verified email
        <>
          <span className="profile-label">Email <span aria-hidden="true">*</span></span>
          <div className="email-field-box">
            <span className="email-field-value">{currentEmail || 'Not set'}</span>
            <span className="email-field-end">
              <span className="badge badge-neutral email-field-badge">Verified</span>
              <button type="button" className="btn btn-ghost btn-sm email-field-action" onClick={openForm}>
                Change
              </button>
            </span>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function formatExpiresIn(iso, now = Date.now()) {
  const target = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(target)) return 'a few minutes';
  const diff = target - now;
  if (diff <= 0) return 'less than a minute';
  const totalMinutes = Math.ceil(diff / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? '' : 's'}`;
  if (minutes === 0) return hourLabel;
  return `${hourLabel} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
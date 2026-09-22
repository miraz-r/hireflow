import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch, apiPost, apiDelete, apiUpload } from '../utils/api';
import Avatar from '../components/Avatar';
import EmailField from '../components/EmailField';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import './AdminAccountPage.css';

const AVATAR_BASE = 'http://localhost:5000';

const CAMERA_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

/**
 * AdminAccountPage - the /admin/account route: the administrator's HireFlow
 * account (identity, editable account details). Deliberately separate from
 * the recruiter/jobseeker professional profile. Reuses the existing account
 * APIs (/auth/me, /api/profile, avatar upload/remove, email-change) and the
 * shared EmailField component.
 */
export default function AdminAccountPage() {
  const { user, setUserFullName, setUserAvatarUrl, refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [showRemoveAvatarConfirm, setShowRemoveAvatarConfirm] = useState(false);
  const [removeAvatarError, setRemoveAvatarError] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/profile');
      setProfile(res.data);
      if (res.data?.fullName) setFullName(res.data.fullName);
      if (res.data?.phone) setPhone(res.data.phone);
      if (res.data?.location) setLocation(res.data.location);
    } catch (err) {
      if (err.status !== 404) {
        setError(err?.message || 'Unable to load your account.');
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFullNameChange = (e) => {
    const { value } = e.target;
    setFullName(value);
    if (fieldErrors.fullName) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.fullName;
        return next;
      });
    }
  };

  const handlePhoneChange = (e) => {
    const { value } = e.target;
    setPhone(value);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.phone;
        return next;
      });
    }
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const payload = { fullName: fullName.trim(), phone: phone.trim(), location };
      let saved;
      if (profile) {
        const res = await apiPatch('/profile', payload);
        saved = res.data;
      } else {
        const res = await apiPost('/profile', payload);
        saved = res.data;
      }
      setProfile(saved);
      if (saved.fullName) setUserFullName(saved.fullName);
      showToast('Changes saved');
    } catch (err) {
      const fieldErrorsData = err?.data?.fieldErrors;
      if (fieldErrorsData && Object.keys(fieldErrorsData).length > 0) {
        setFieldErrors(fieldErrorsData);
        setError('');
      } else {
        setError(err?.message || 'Unable to save your account.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await apiUpload('/profile/upload/avatar', fd);
      const updated = res.data;
      setProfile(updated);
      if (updated.avatarUrl) setUserAvatarUrl(updated.avatarUrl);
      showToast('Profile picture updated');
    } catch (err) {
      setError(err?.message || 'Unable to upload your profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    setRemoveAvatarError('');
    try {
      const res = await apiDelete('/profile/avatar');
      const updated = res.data;
      setProfile(updated);
      if (updated.avatarUrl) {
        setUserAvatarUrl(updated.avatarUrl);
      } else {
        setUserAvatarUrl('');
      }
      setShowRemoveAvatarConfirm(false);
      showToast('Profile picture removed');
    } catch (err) {
      setRemoveAvatarError(err?.message || 'Unable to remove your profile picture.');
    } finally {
      setRemovingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page admin-account-page" aria-busy="true">
        <div className="admin-section-card">
          <div className="admin-skeleton admin-skeleton-account" />
          <div className="admin-skeleton admin-skeleton-account" />
        </div>
      </div>
    );
  }

  const avatarSrc = profile?.avatarUrl
    ? `${AVATAR_BASE}${profile.avatarUrl}`
    : user?.avatarUrl
      ? `${AVATAR_BASE}${user.avatarUrl}`
      : null;

  const fieldError = (name) =>
    fieldErrors[name] ? (
      <span className="profile-field-error" role="alert">{fieldErrors[name]}</span>
    ) : null;

  return (
    <div className="admin-page admin-account-page">
      {error && (
        <div className="auth-alert auth-alert-error admin-account-alert" role="alert">
          <span>{error}</span>
        </div>
      )}

      <header className="admin-account-header">
        <h2 className="admin-account-title">Account</h2>
        <p className="admin-account-sub">Manage your HireFlow account.</p>
      </header>

      {/* Identity */}
      <section className="admin-section-card" aria-label="Profile">
        <div className="admin-account-identity-body">
          <div className="admin-account-avatar-col">
            <div className="admin-account-avatar-wrap">
              <Avatar
                src={avatarSrc}
                imgAlt="Profile"
                imgClassName="admin-account-avatar"
                placeholderClassName="admin-account-avatar admin-account-avatar--placeholder"
                iconSize={32}
              />
              <label className="admin-account-avatar-upload" title="Change profile picture">
                {uploadingAvatar ? '…' : CAMERA_ICON}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            {avatarSrc && (
              <button
                type="button"
                className="admin-account-avatar-remove"
                onClick={() => {
                  setRemoveAvatarError('');
                  setShowRemoveAvatarConfirm(true);
                }}
                disabled={removingAvatar}
              >
                Remove picture
              </button>
            )}
          </div>

          <div className="admin-account-identity-meta">
            <h3 className="admin-account-name">
              {fullName || user?.fullName || user?.email || 'Administrator'}
            </h3>
            <p className="admin-account-email">{user?.email}</p>
            <p className="admin-account-role">Administrator</p>
          </div>
        </div>
      </section>

      {/* Account details */}
      <section className="admin-section-card" aria-label="Account details">
        <form onSubmit={saveAccount} noValidate>
          <div className="admin-account-fields">
            <div className="admin-account-field">
              <label className="admin-account-label" htmlFor="admin-account-full-name">Full name</label>
              <input
                id="admin-account-full-name"
                name="fullName"
                className={`input ${fieldErrors.fullName ? 'input-error' : ''}`}
                value={fullName}
                onChange={handleFullNameChange}
                required
                placeholder="Your name"
              />
              {fieldError('fullName')}
            </div>

            <EmailField currentEmail={user?.email || ''} onEmailChanged={() => refreshUser()} />

            <div className="admin-account-field admin-account-field--full">
              <label className="admin-account-label" htmlFor="admin-account-phone">Phone <span aria-hidden="true">*</span></label>
              <input
                id="admin-account-phone"
                name="phone"
                className={`input ${fieldErrors.phone ? 'input-error' : ''}`}
                value={phone}
                onChange={handlePhoneChange}
                required
                placeholder="+1 555 123 4567"
              />
              {fieldError('phone')}
            </div>
          </div>

          <div className="admin-account-form-actions">
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <ConfirmModal
        open={showRemoveAvatarConfirm}
        title="Remove profile picture?"
        confirmLabel="Remove picture"
        busyLabel="Removing…"
        busy={removingAvatar}
        onClose={() => {
          setShowRemoveAvatarConfirm(false);
          setRemoveAvatarError('');
        }}
        onConfirm={handleRemoveAvatar}
      >
        <p className="modal-desc">
          Your profile picture will be removed and your default avatar will be shown instead.
          You can upload a new picture anytime.
        </p>
        {removeAvatarError && <div className="auth-alert auth-alert-error" role="alert"><span>{removeAvatarError}</span></div>}
      </ConfirmModal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
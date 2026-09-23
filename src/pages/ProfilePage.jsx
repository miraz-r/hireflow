import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '../utils/api';
import { categories, workTypes, employmentTypes, experienceLevels } from '../data/mockData';
import { STATUS_LABELS } from '../constants/applicationStatus';
import Toast from '../components/Toast';
import Avatar from '../components/Avatar';
import ConfirmModal from '../components/ConfirmModal';
import ProfileTabs from '../components/ProfileTabs';
import EmailField from '../components/EmailField';
import Select from '../components/ui/Select';
import './ProfilePage.css';

const AVATAR_BASE = 'http://localhost:5000';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'profile';

  // Redirect to login if not authenticated.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Administrators use the dedicated /admin/account page, not the
  // recruiter/jobseeker professional profile. Redirect before any profile UI
  // renders, and never paint the jobseeker profile for an admin.
  useEffect(() => {
    if (!authLoading && user?.role === 'admin') {
      navigate('/admin/account', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Ensure the active tab is valid for the current role. After a role switch,
  // the URL may still carry a tab param that the new role cannot access (e.g.
  // "post" or "applications" after switching to jobseeker). Force-redirect to
  // the profile tab so the user never sees a forbidden state.
  const RECRUITER_ONLY_TABS = ['post'];
  const JOBSEEKER_ONLY_TABS = ['my-applications', 'saved-jobs'];

  useEffect(() => {
    if (user?.role === 'recruiter' && tab === 'recruiter-applications') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, tab, navigate]);

  useEffect(() => {
    if (user && RECRUITER_ONLY_TABS.includes(tab) && user.role !== 'recruiter') {
      setSearchParams({}, { replace: true });
    }
    if (user && tab === 'saved-jobs' && user.role === 'jobseeker') {
      navigate('/saved-jobs', { replace: true });
    } else if (user && JOBSEEKER_ONLY_TABS.includes(tab) && user.role !== 'jobseeker') {
      setSearchParams({}, { replace: true });
    }
  }, [tab, user, setSearchParams, navigate]);

  if (authLoading) {
    return <div className="app-loading" aria-busy="true" />;
  }
  if (!user) return null;
  if (user.role === 'admin') return null;

  if (user.role === 'recruiter' && tab === 'recruiter-applications') {
    return null;
  }

  return (
    <div className="profile-page">
      <div className="container">
        <ProfileTabs role={user.role} />

        {tab === 'post' ? (
          <PostJobTab />
        ) : tab === 'my-applications' ? (
          <JobseekerApplicationsTab />
        ) : (
          <ProfileTab user={user} />
        )}
      </div>
    </div>
  );
}

/* ======================================================================= */
/* Email change - extracted to src/components/EmailField.jsx. The admin     */
/* account page reuses the same component, so recruiter/jobseeker behavior  */
/* stays identical.                                                         */
/* ======================================================================= */

/* ======================================================================= */
/* Profile tab - contact, role fields, avatar, resume, social links         */
/* ======================================================================= */
function ProfileTab({ user }) {
  const navigate = useNavigate();
  const { setUserFullName, setUserAvatarUrl, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({});
  const [draftLink, setDraftLink] = useState({ label: '', url: '' });
  // null = not editing any experience entry; otherwise { index, data }
  const [expDraft, setExpDraft] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showRemoveAvatarConfirm, setShowRemoveAvatarConfirm] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [removeAvatarError, setRemoveAvatarError] = useState('');

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      const res = await apiGet('/profile');
      setProfile(res.data);
      setForm(res.data || {});
    } catch (err) {
      if (err.status !== 404) {
        setError(err?.message || 'Unable to load your profile.');
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const isRecruiter = user.role === 'recruiter';

  // Build a role-aware payload. Only fields valid for the current role are
  // sent, so a stale recruiter field can never leak into a jobseeker save
  // (and vice versa). Shared fields go for both roles.
  const buildPayload = (data) => {
    const shared = ['fullName', 'phone', 'location'];
    const roleFields = isRecruiter
      ? ['jobTitle', 'companyName', 'companyWebsite', 'companyDescription']
      : ['headline', 'bio', 'skills', 'education', 'experience', 'links', 'resumeUrl', 'resumeName'];
    const payload = {};
    for (const key of [...shared, ...roleFields]) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        payload[key] = data[key];
      }
    }
    return payload;
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const payload = buildPayload(form);
      let saved;
      if (profile) {
        const res = await apiPatch('/profile', payload);
        saved = res.data;
      } else {
        const res = await apiPost('/profile', payload);
        saved = res.data;
      }
      setProfile(saved);
      setForm(saved);
      if (saved.fullName) setUserFullName(saved.fullName);
      showToast('Profile saved');
    } catch (err) {
      const fieldErrorsData = err?.data?.fieldErrors;
      if (fieldErrorsData && Object.keys(fieldErrorsData).length > 0) {
        // Field-mappable validation errors live under their inputs only -
        // don't repeat them in a top-level alert.
        setFieldErrors(fieldErrorsData);
        setError('');
      } else {
        setError(err?.message || 'Unable to save your profile.');
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
      setForm(updated);
      if (updated.avatarUrl) setUserAvatarUrl(updated.avatarUrl);
      showToast('Profile picture updated');
    } catch (err) {
      setError(err?.message || 'Unable to upload your profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Remove the stored profile picture. The UI (avatar + remove option) is only
  // updated after the backend confirms success, so a failed request never
  // falsely clears the avatar.
  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    setRemoveAvatarError('');
    try {
      const res = await apiDelete('/profile/avatar');
      const updated = res.data;
      setProfile(updated);
      setForm(updated);
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

  const handleResumeUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploadingResume(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const res = await apiUpload('/profile/upload/resume', fd);
      const updated = res.data;
      setProfile(updated);
      setForm(updated);
      showToast('Resume uploaded');
    } catch (err) {
      setError(err?.message || 'Unable to upload your resume.');
    } finally {
      setUploadingResume(false);
    }
  };

  const addLink = () => {
    if (!draftLink.label.trim() || !draftLink.url.trim()) {
      setFieldErrors((prev) => ({ ...prev, links: 'Enter a label and URL for the link.' }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.links;
      return next;
    });
    const links = Array.isArray(form.links) ? form.links : [];
    setForm((prev) => ({ ...prev, links: [...links, { label: draftLink.label.trim(), url: draftLink.url.trim() }] }));
    setDraftLink({ label: '', url: '' });
  };

  const removeLink = (index) => {
    const links = Array.isArray(form.links) ? form.links : [];
    setForm((prev) => ({ ...prev, links: links.filter((_, i) => i !== index) }));
  };

  /* ---------- Experience editor ---------- */
  const startAddExp = () =>
    setExpDraft({ index: null, data: { title: '', company: '', location: '', startDate: '', endDate: '', current: false, description: '' } });

  const startEditExp = (i) => {
    const existing = Array.isArray(form.experience) ? form.experience[i] : null;
    if (!existing) return;
    setExpDraft({
      index: i,
      data: {
        title: existing.title || '',
        company: existing.company || '',
        location: existing.location || '',
        startDate: existing.startDate ? String(existing.startDate).slice(0, 10) : '',
        endDate: existing.endDate ? String(existing.endDate).slice(0, 10) : '',
        current: !!existing.current,
        description: existing.description || '',
      },
    });
    if (fieldErrors.experience) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n.experience; return n; });
    }
  };

  const cancelExpEdit = () => {
    setExpDraft(null);
    // Discard any validation message tied to this unfinished entry so the
    // section returns to its clean empty state instead of carrying
    // stale "required" errors (and the form-level hint) after cancelling.
    setFieldErrors((prev) => {
      if (!prev.experience) return prev;
      const n = { ...prev };
      delete n.experience;
      return n;
    });
  };

  const setExpField = (name, value) =>
    setExpDraft((prev) => (prev ? { ...prev, data: { ...prev.data, [name]: value } } : prev));

  const saveExp = () => {
    if (!expDraft) return;
    const d = expDraft.data;
    let msg = null;
    if (!d.title.trim()) msg = 'Job title is required.';
    else if (!d.company.trim()) msg = 'Company is required.';
    else if (!d.startDate) msg = 'Start date is required.';
    if (msg) {
      setFieldErrors((prev) => ({ ...prev, experience: msg }));
      return;
    }
    if (d.current && d.endDate) {
      setFieldErrors((prev) => ({ ...prev, experience: 'End date should be cleared when this is your current position.' }));
      return;
    }
    const expArr = Array.isArray(form.experience) ? form.experience.slice() : [];
    const entry = {
      title: d.title.trim(),
      company: d.company.trim(),
      location: d.location ? d.location.trim() : '',
      startDate: d.startDate,
      endDate: d.current ? undefined : d.endDate || undefined,
      current: !!d.current,
      description: d.description ? d.description.trim() : '',
    };
    if (expDraft.index === null) {
      expArr.push(entry);
    } else {
      const existing = form.experience[expDraft.index];
      if (existing && existing._id) entry._id = existing._id;
      expArr[expDraft.index] = entry;
    }
    setForm((prev) => ({ ...prev, experience: expArr }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n.experience; return n; });
    setExpDraft(null);
  };

  const removeExp = (i) => {
    const expArr = Array.isArray(form.experience) ? form.experience.slice() : [];
    expArr.splice(i, 1);
    setForm((prev) => ({ ...prev, experience: expArr }));
  };

  const formatExpDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const handleDeleteProfile = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await apiDelete('/profile');
      localStorage.removeItem('token');
      window.location.href = '/login';
    } catch (err) {
      setDeleteError(err?.message || 'Unable to delete your profile.');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="app-loading" aria-busy="true" />;
  }

  const avatarSrc = form.avatarUrl ? `${AVATAR_BASE}${form.avatarUrl}` : null;

  const fieldError = (name) =>
    fieldErrors[name] ? (
      <span className="profile-field-error" role="alert">{fieldErrors[name]}</span>
    ) : null;

  return (
    <>
      <div className="card profile-header-card">
        <div className="profile-header">
          <div className="profile-avatar-col">
            <div className="profile-avatar-wrap">
              <Avatar
                src={avatarSrc}
                imgAlt="Profile"
                imgClassName="profile-avatar"
                placeholderClassName="profile-avatar profile-avatar--placeholder"
                iconSize={36}
              />
              <label className="profile-avatar-upload" title="Change profile picture">
                {uploadingAvatar ? (
                  '…'
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
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
                className="profile-avatar-remove"
                onClick={() => {
                  setRemoveAvatarError('');
                  setShowRemoveAvatarConfirm(true);
                }}
              >
                Remove picture
              </button>
            )}
          </div>
          <div className="profile-header-text">
            <h1 className="profile-title">{form.fullName || user.email || 'Your profile'}</h1>
            <p className="profile-subtitle">
              {isRecruiter
                ? 'Manage your recruiting profile and company details.'
                : 'Manage your professional profile and experience.'}
            </p>
          </div>
          {profile && (
            <span className="badge badge-neutral profile-status-badge">
              {isRecruiter ? 'Recruiting' : 'Looking for work'}
            </span>
          )}
        </div>
      </div>

      {!profile && !loading && (
        <div className="card profile-welcome">
          <p>
            Welcome! You haven't set up your profile yet. Fill in your details below, and
            you can edit them anytime.
          </p>
        </div>
      )}

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <form className="card profile-form" onSubmit={saveProfile} noValidate>
        <fieldset className="profile-fieldset profile-fieldset--heading-gap">
          <legend className="profile-fieldset-title">Contact details</legend>
          <div className="profile-grid">
            <div className="profile-field">
              <label className="profile-label" htmlFor="fullName">Full name <span aria-hidden="true">*</span></label>
              <input
                id="fullName"
                name="fullName"
                className={`input ${fieldErrors.fullName ? 'input-error' : ''}`}
                value={form.fullName || ''}
                onChange={handleChange}
                required
                placeholder="Jane Doe"
              />
              {fieldError('fullName')}
            </div>
            <EmailField currentEmail={user?.email || ''} onEmailChanged={() => refreshUser()} />
            <div className="profile-field">
              <label className="profile-label" htmlFor="phone">Phone <span aria-hidden="true">*</span></label>
              <input
                id="phone"
                name="phone"
                className={`input ${fieldErrors.phone ? 'input-error' : ''}`}
                value={form.phone || ''}
                onChange={handleChange}
                required
                placeholder="+1 555 123 4567"
              />
              {fieldError('phone')}
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="location">Location <span aria-hidden="true">*</span></label>
              <input
                id="location"
                name="location"
                className={`input ${fieldErrors.location ? 'input-error' : ''}`}
                value={form.location || ''}
                onChange={handleChange}
                required
                placeholder="San Francisco, CA"
              />
              {fieldError('location')}
            </div>
          </div>
        </fieldset>

        {isRecruiter ? (
          <fieldset className="profile-fieldset">
            <legend className="profile-fieldset-title">Company</legend>
            <div className="profile-grid">
              <div className="profile-field">
                <label className="profile-label" htmlFor="jobTitle">Job title</label>
                <input id="jobTitle" name="jobTitle" className={`input ${fieldErrors.jobTitle ? 'input-error' : ''}`} value={form.jobTitle || ''} onChange={handleChange} placeholder="Talent Acquisition Lead" />
                {fieldError('jobTitle')}
              </div>
              <div className="profile-field">
                <label className="profile-label" htmlFor="companyName">Company name</label>
                <input id="companyName" name="companyName" className={`input ${fieldErrors.companyName ? 'input-error' : ''}`} value={form.companyName || ''} onChange={handleChange} placeholder="Acme Corp" />
                {fieldError('companyName')}
              </div>
              <div className="profile-field">
                <label className="profile-label" htmlFor="companyWebsite">Company website</label>
                <input id="companyWebsite" name="companyWebsite" className={`input ${fieldErrors.companyWebsite ? 'input-error' : ''}`} value={form.companyWebsite || ''} onChange={handleChange} placeholder="https://acme.com" />
                {fieldError('companyWebsite')}
              </div>
              <div className="profile-field profile-field--full">
                <label className="profile-label" htmlFor="companyDescription">Company description</label>
                <textarea id="companyDescription" name="companyDescription" className="input profile-textarea" value={form.companyDescription || ''} onChange={handleChange} rows={4} placeholder="What does your company do?" />
                {fieldError('companyDescription')}
              </div>
            </div>
          </fieldset>
        ) : (
          <>
            <fieldset className="profile-fieldset profile-fieldset--heading-gap">
              <legend className="profile-fieldset-title">About you</legend>
              <div className="profile-grid">
                <div className="profile-field profile-field--full">
                  <label className="profile-label" htmlFor="headline">Headline</label>
                  <input id="headline" name="headline" className={`input ${fieldErrors.headline ? 'input-error' : ''}`} value={form.headline || ''} onChange={handleChange} placeholder="Senior React Engineer" />
                  {fieldError('headline')}
                </div>
                <div className="profile-field profile-field--full">
                  <label className="profile-label" htmlFor="bio">Bio</label>
                  <textarea id="bio" name="bio" className="input profile-textarea" value={form.bio || ''} onChange={handleChange} rows={4} placeholder="A short summary of who you are and what you're looking for." />
                  {fieldError('bio')}
                </div>
                <div className="profile-field profile-field--full">
                  <label className="profile-label" htmlFor="skills">Skills (comma separated)</label>
                  <input
                    id="skills"
                    name="skills"
                    className={`input ${fieldErrors.skills ? 'input-error' : ''}`}
                    value={Array.isArray(form.skills) ? form.skills.join(', ') : ''}
                    onChange={(e) => {
                      const skills = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                      setForm((prev) => ({ ...prev, skills }));
                      if (fieldErrors.skills) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.skills;
                          return next;
                        });
                      }
                    }}
                    placeholder="React, TypeScript, Next.js"
                  />
                  {fieldError('skills')}
                </div>
              </div>
            </fieldset>

            <fieldset className="profile-fieldset">
              <legend className="profile-fieldset-title">Social links</legend>
              {(Array.isArray(form.links) ? form.links : []).map((link, i) => (
                <div className="profile-link-row" key={i}>
                  <span className="profile-link-label">{link.label}</span>
                  <a href={link.url} target="_blank" rel="noreferrer" className="profile-link-url">{link.url}</a>
                  <button type="button" className="profile-link-remove" onClick={() => removeLink(i)} aria-label={`Remove ${link.label}`}>
                    ✕
                  </button>
                </div>
              ))}
              <div className="profile-link-add">
                <input className="input profile-link-input" placeholder="Label (e.g. GitHub)" value={draftLink.label} onChange={(e) => setDraftLink((p) => ({ ...p, label: e.target.value }))} />
                <input className="input profile-link-input" placeholder="https://github.com/you" value={draftLink.url} onChange={(e) => setDraftLink((p) => ({ ...p, url: e.target.value }))} />
                <button type="button" className="btn btn-secondary" onClick={addLink}>Add link</button>
              </div>
              {fieldError('links')}
            </fieldset>

            <fieldset className="profile-fieldset">
              <legend className="profile-fieldset-title">Resume / CV</legend>
              <div className="profile-resume">
                {form.resumeUrl ? (
                  <div className="profile-resume-uploaded">
                    <span className="profile-resume-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="16" y2="17" />
                      </svg>
                    </span>
                    <div>
                      <strong>{form.resumeName || 'Resume'}</strong>
                      <a href={`${AVATAR_BASE}${form.resumeUrl}`} target="_blank" rel="noreferrer" className="profile-link-url">View / download</a>
                    </div>
                  </div>
                ) : (
                  <p className="profile-empty">No resume uploaded yet.</p>
                )}
                <label className={`btn btn-secondary ${uploadingResume ? 'disabled' : ''}`}>
                  {uploadingResume ? 'Uploading…' : form.resumeUrl ? 'Replace resume' : 'Upload resume'}
                  <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleResumeUpload} disabled={uploadingResume} />
                </label>
                <p className="profile-hint">PDF, DOC, DOCX or TXT · up to 10MB</p>
              </div>
            </fieldset>

            <fieldset className="profile-fieldset">
              <legend className="profile-fieldset-title">Experience</legend>
              {Array.isArray(form.experience) && form.experience.length > 0 ? (
                <div className="profile-list">
                  {form.experience.map((exp, i) => (
                    <div className="profile-list-item" key={i}>
                      <div className="profile-list-item-head">
                        <div className="profile-list-item-text">
                          <strong className="profile-exp-title">{exp.title}</strong>
                          <span className="profile-exp-company">{exp.company}{exp.location ? ` · ${exp.location}` : ''}</span>
                          <span className="profile-exp-date">
                            {formatExpDate(exp.startDate)}{exp.current ? ' – Present' : exp.endDate ? ` – ${formatExpDate(exp.endDate)}` : ''}
                          </span>
                        </div>
                        <div className="profile-list-item-actions">
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => startEditExp(i)}>Edit</button>
                          <button type="button" className="btn btn-sm btn-ghost profile-exp-remove" onClick={() => removeExp(i)}>Remove</button>
                        </div>
                      </div>
                      {exp.description && <p className="profile-list-item-desc">{exp.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty">No experience added yet.</p>
              )}

              {!expDraft && (
                <button type="button" className="btn btn-secondary" onClick={startAddExp}>+ Add experience</button>
              )}
              {!expDraft && fieldError('experience')}

              {expDraft && (
                <div className="card profile-exp-editor">
                  <h4 className="profile-exp-editor-title">{expDraft.index === null ? 'Add experience' : 'Edit experience'}</h4>
                  <div className="profile-grid">
                    <div className="profile-field">
                      <label className="profile-label" htmlFor="exp-title">Job title <span aria-hidden="true">*</span></label>
                      <input id="exp-title" className="input" type="text" value={expDraft.data.title} onChange={(e) => setExpField('title', e.target.value)} placeholder="Lead Engineer" />
                    </div>
                    <div className="profile-field">
                      <label className="profile-label" htmlFor="exp-company">Company <span aria-hidden="true">*</span></label>
                      <input id="exp-company" className="input" type="text" value={expDraft.data.company} onChange={(e) => setExpField('company', e.target.value)} placeholder="Acme Corp" />
                    </div>
                    <div className="profile-field">
                      <label className="profile-label" htmlFor="exp-location">Location</label>
                      <input id="exp-location" className="input" type="text" value={expDraft.data.location} onChange={(e) => setExpField('location', e.target.value)} placeholder="San Francisco, CA" />
                    </div>
                    <div className="profile-field">
                      <label className="profile-label" htmlFor="exp-start">Start date <span aria-hidden="true">*</span></label>
                      <input id="exp-start" className="input" type="date" value={expDraft.data.startDate} onChange={(e) => setExpField('startDate', e.target.value)} />
                    </div>
                    <div className="profile-field">
                      <label className="profile-label" htmlFor="exp-end">End date</label>
                      <input id="exp-end" className="input" type="date" value={expDraft.data.endDate} onChange={(e) => setExpField('endDate', e.target.value)} disabled={expDraft.data.current} />
                    </div>
                    <div className="profile-field profile-exp-current">
                      <label className="profile-check">
                        <input type="checkbox" checked={expDraft.data.current} onChange={(e) => setExpField('current', e.target.checked)} />
                        <span>I currently work here</span>
                      </label>
                    </div>
                    <div className="profile-field profile-field--full">
                      <label className="profile-label" htmlFor="exp-desc">Description</label>
                      <textarea id="exp-desc" className="input profile-textarea" rows={3} value={expDraft.data.description} onChange={(e) => setExpField('description', e.target.value)} placeholder="What did you work on?" />
                    </div>
                  </div>
                  {fieldError('experience')}
                  {fieldErrors.experience && (
                    <p className="profile-validation-hint" role="alert">Please complete the required fields.</p>
                  )}
                  <div className="profile-exp-editor-actions">
                    <button type="button" className="btn btn-primary" onClick={saveExp}>{expDraft.index === null ? 'Add experience' : 'Save experience'}</button>
                    <button type="button" className="btn btn-ghost" onClick={cancelExpEdit}>Cancel</button>
                  </div>
                </div>
              )}
            </fieldset>
          </>
        )}

        <div className="profile-actions">
          <div className="profile-actions-left">
            {Object.keys(fieldErrors).some((key) => key !== 'experience') && (
              <p className="profile-validation-hint" role="alert">Please complete the required fields.</p>
            )}
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Saving…' : profile ? 'Save changes' : 'Create profile'}
            </button>
          </div>
        </div>
      </form>

      {/* Delete profile - visually separated, destructive action */}
      {profile && (
        <div className="profile-danger-zone">
          <div className="profile-danger-header">
            <h3 className="profile-danger-title">Danger zone</h3>
          </div>
          <div className="profile-danger-body">
            <p className="profile-danger-desc">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete profile
            </button>
          </div>
        </div>
      )}

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
          Your profile picture will be removed and your default avatar will be shown instead. You can upload a new picture anytime.
        </p>
        {removeAvatarError && <div className="auth-alert auth-alert-error" role="alert"><span>{removeAvatarError}</span></div>}
      </ConfirmModal>

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete profile?"
        confirmLabel="Delete profile"
        busyLabel="Deleting…"
        busy={deleting}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteError('');
        }}
        onConfirm={handleDeleteProfile}
      >
        <p className="modal-desc">
          This will permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {deleteError && <div className="auth-alert auth-alert-error" role="alert"><span>{deleteError}</span></div>}
      </ConfirmModal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

/* ======================================================================= */
/* Post a job tab - recruiter-only                                          */
/* ======================================================================= */
function PostJobTab() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    workType: 'Remote',
    employmentType: 'Full-time',
    experienceLevel: 'Mid-level',
    category: 'Engineering',
    salaryMin: '',
    salaryMax: '',
    skills: '',
    description: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        company: form.company.trim(),
        location: form.location.trim(),
        workType: form.workType,
        employmentType: form.employmentType,
        experienceLevel: form.experienceLevel,
        category: form.category,
        salary: {
          min: Number(form.salaryMin) || undefined,
          max: Number(form.salaryMax) || undefined,
        },
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        description: form.description.trim(),
      };
      await apiPost('/jobs', payload);
      setToast('Job posted');
      setTimeout(() => setToast(null), 3000);
      setForm({ ...form, title: '', location: '', salaryMin: '', salaryMax: '', skills: '', description: '' });
    } catch (err) {
      const fieldErrorsData = err?.data?.fieldErrors;
      if (fieldErrorsData && Object.keys(fieldErrorsData).length > 0) {
        setFieldErrors(fieldErrorsData);
        setError('');
      } else {
        setError(err?.message || 'Unable to post the job.');
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name) =>
    fieldErrors[name] ? (
      <span className="profile-field-error" role="alert">{fieldErrors[name]}</span>
    ) : null;

  return (
    <div className="card profile-form">
      <div className="profile-header">
        <div className="profile-header-text">
          <h1 className="profile-title">Post a job</h1>
          <p className="profile-subtitle">Share a new role and start receiving applicants.</p>
        </div>
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}

      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="profile-fieldset">
          <legend className="profile-fieldset-title">Role details</legend>
          <div className="profile-grid">
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-title">Job title <span aria-hidden="true">*</span></label>
              <input id="post-title" name="title" className={`input ${fieldErrors.title ? 'input-error' : ''}`} value={form.title} onChange={handleChange} required placeholder="Senior Frontend Engineer" />
              {fieldError('title')}
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-company">Company <span aria-hidden="true">*</span></label>
              <input id="post-company" name="company" className={`input ${fieldErrors.company ? 'input-error' : ''}`} value={form.company} onChange={handleChange} required placeholder="Acme Corp" />
              {fieldError('company')}
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-location">Location</label>
              <input id="post-location" name="location" className={`input ${fieldErrors.location ? 'input-error' : ''}`} value={form.location} onChange={handleChange} placeholder="Remote / San Francisco, CA" />
              {fieldError('location')}
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-category">Category</label>
              <Select
                id="post-category"
                name="category"
                className={`input ${fieldErrors.category ? 'input-error' : ''}`}
                value={form.category}
                onChange={handleChange}
                options={categories.map((c) => ({ value: c.name, label: c.name }))}
              />
              {fieldError('category')}
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-worktype">Work type</label>
              <Select
                id="post-worktype"
                name="workType"
                className="input"
                value={form.workType}
                onChange={handleChange}
                options={workTypes.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-emptype">Employment type</label>
              <Select
                id="post-emptype"
                name="employmentType"
                className="input"
                value={form.employmentType}
                onChange={handleChange}
                options={employmentTypes.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-exp">Experience level</label>
              <Select
                id="post-exp"
                name="experienceLevel"
                className="input"
                value={form.experienceLevel}
                onChange={handleChange}
                options={experienceLevels.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-smin">Salary min</label>
              <input id="post-smin" name="salaryMin" className="input" type="number" value={form.salaryMin} onChange={handleChange} placeholder="80000" />
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-smax">Salary max</label>
              <input id="post-smax" name="salaryMax" className="input" type="number" value={form.salaryMax} onChange={handleChange} placeholder="120000" />
            </div>
            <div className="profile-field profile-field--full">
              <label className="profile-label" htmlFor="post-skills">Skills (comma separated)</label>
              <input id="post-skills" name="skills" className="input" value={form.skills} onChange={handleChange} placeholder="React, TypeScript, Next.js" />
            </div>
            <div className="profile-field profile-field--full">
              <label className="profile-label" htmlFor="post-desc">Job description</label>
              <textarea id="post-desc" name="description" className="input profile-textarea" rows={5} value={form.description} onChange={handleChange} placeholder="Describe the role, responsibilities, and what you're looking for." />
            </div>
          </div>
        </fieldset>

        <div className="profile-actions">
          <div className="profile-actions-left">
            {Object.keys(fieldErrors).length > 0 && (
              <p className="profile-validation-hint" role="alert">Please complete the required fields.</p>
            )}
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Creating job…' : 'Post job'}
            </button>
          </div>
        </div>
      </form>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ======================================================================= */
/* Jobseeker Applications tab - the current jobseeker's own applications    */
/* ======================================================================= */
function JobseekerApplicationsTab() {
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiGet('/applications/my-applications');
        if (!cancelled) setApplications(res.data?.applications || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Unable to load your applications.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="app-loading" aria-busy="true" />;
  }

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="card profile-form js-application-tab">
      <div className="profile-header">
        <div className="profile-header-text">
          <h1 className="profile-title">My Applications</h1>
          <p className="profile-subtitle">Track the jobs you've applied to and their current status.</p>
        </div>
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}

      {!error && applications.length === 0 && (
        <div className="app-empty-state">
          <div className="app-empty-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <h3 className="app-empty-title">No applications yet</h3>
          <p className="app-empty-desc">
            When you apply to a job, it will show up here so you can track its status. Start exploring roles on Find Jobs.
          </p>
          <Link to="/" className="btn btn-primary">Browse jobs</Link>
        </div>
      )}

      {applications.length > 0 && (
        <div className="app-list">
          {applications.map((app) => (
            <article className="app-card" key={app.id}>
              <div className="app-card-main">
                <div className="app-card-avatar" aria-hidden="true">
                  {(app.job?.company || 'C').charAt(0)}
                </div>
                <div className="app-card-info">
                  <h3 className="app-card-title">{app.job?.title || 'Job'}</h3>
                  <p className="app-card-company">
                    {app.job?.company || '-'}
                    {app.job?.location ? <span className="app-card-sep" aria-hidden="true">·</span> : null}
                    {app.job?.location || ''}
                  </p>
                </div>
                <span className={`app-status app-status--${app.status}`}>
                  <span className="app-status-dot" aria-hidden="true" />
                  {STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
              <div className="app-card-footer">
                <time className="app-card-date" dateTime={app.createdAt}>
                  Applied {fmtDate(app.createdAt)}
                </time>
                {app.job?.id && (
                  <Link to={`/jobs/${app.job.id}`} state={{ from: 'applications' }} className="btn btn-sm btn-secondary app-card-link">
                    View job
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14"/>
                      <path d="M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

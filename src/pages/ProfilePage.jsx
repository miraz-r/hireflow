import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '../utils/api';
import { categories, workTypes, employmentTypes, experienceLevels } from '../data/mockData';
import Toast from '../components/Toast';
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

  // Ensure the active tab is valid for the current role. After a role switch,
  // the URL may still carry a tab param that the new role cannot access (e.g.
  // "post" or "applications" after switching to jobseeker). Force-redirect to
  // the profile tab so the user never sees a forbidden state.
  const RECRUITER_ONLY_TABS = ['post', 'recruiter-applications'];
  const JOBSEEKER_ONLY_TABS = ['my-applications', 'saved-jobs'];
  useEffect(() => {
    if (user && RECRUITER_ONLY_TABS.includes(tab) && user.role !== 'recruiter') {
      setSearchParams({}, { replace: true });
    }
    if (user && JOBSEEKER_ONLY_TABS.includes(tab) && user.role !== 'jobseeker') {
      setSearchParams({}, { replace: true });
    }
  }, [tab, user, setSearchParams]);

  if (authLoading) {
    return <div className="app-loading" aria-busy="true" />;
  }
  if (!user) return null;

  const setTab = (next) => setSearchParams(next === 'profile' ? {} : { tab: next });

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            className={`profile-tab ${tab === 'profile' ? 'active' : ''}`}
            onClick={() => setTab('profile')}
          >
            Profile
          </button>
          {user.role === 'jobseeker' && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'my-applications'}
                className={`profile-tab ${tab === 'my-applications' ? 'active' : ''}`}
                onClick={() => setTab('my-applications')}
              >
                Applications
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'saved-jobs'}
                className={`profile-tab ${tab === 'saved-jobs' ? 'active' : ''}`}
                onClick={() => setTab('saved-jobs')}
              >
                Saved Jobs
              </button>
            </>
          )}
          {user.role === 'recruiter' && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'post'}
                className={`profile-tab ${tab === 'post' ? 'active' : ''}`}
                onClick={() => setTab('post')}
              >
                Post a job
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'recruiter-applications'}
                className={`profile-tab ${tab === 'recruiter-applications' ? 'active' : ''}`}
                onClick={() => setTab('recruiter-applications')}
              >
                Applications
              </button>
            </>
          )}
        </div>

        {tab === 'post' ? (
          <PostJobTab />
        ) : tab === 'recruiter-applications' ? (
          <ApplicationsTab />
        ) : tab === 'my-applications' ? (
          <JobseekerApplicationsTab />
        ) : tab === 'saved-jobs' ? (
          <SavedJobsTab />
        ) : (
          <ProfileTab user={user} />
        )}
      </div>
    </div>
  );
}

/* ======================================================================= */
/* Profile tab — contact, role fields, avatar, resume, social links         */
/* ======================================================================= */
function ProfileTab({ user }) {
  const navigate = useNavigate();
  const { setUserFullName, setUserAvatarUrl } = useAuth();
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
        // Field-mappable validation errors live under their inputs only —
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

  const cancelExpEdit = () => setExpDraft(null);

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
      <div className="profile-header">
        <div className="profile-avatar-wrap">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Profile" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar--placeholder">
              {(form.fullName || user.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
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

      {!profile && !loading && (
        <div className="card profile-welcome">
          <p>
            Welcome! You haven't set up your profile yet. Fill in your details below —
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
        <fieldset className="profile-fieldset">
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
            <div className="profile-field">
              <label className="profile-label" htmlFor="account-email">Email <span aria-hidden="true">*</span></label>
              <input
                id="account-email"
                name="email"
                className="input"
                value={user.email || ''}
                readOnly
                disabled
                aria-describedby="account-email-hint"
              />
              <span className="profile-field-hint" id="account-email-hint">Your account email — managed in your login details.</span>
            </div>
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
            <fieldset className="profile-fieldset">
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
            {Object.keys(fieldErrors).length > 0 && (
              <p className="profile-validation-hint" role="alert">Please complete the required fields.</p>
            )}
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Saving…' : profile ? 'Save changes' : 'Create profile'}
            </button>
          </div>
        </div>
      </form>

      {/* Delete profile — visually separated, destructive action */}
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

      {showDeleteConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="modal-content">
            <h3 id="delete-dialog-title" className="modal-title">Delete profile?</h3>
            <p className="modal-desc">
              This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            {deleteError && <div className="auth-alert auth-alert-error" role="alert"><span>{deleteError}</span></div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}>Cancel</button>
              <button type="button" className="btn btn-danger" disabled={deleting} onClick={handleDeleteProfile}>
                {deleting ? 'Deleting…' : 'Delete profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

/* ======================================================================= */
/* Post a job tab — recruiter-only                                          */
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
          <span className="section-eyebrow">Post</span>
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
              <select id="post-category" name="category" className={`input ${fieldErrors.category ? 'input-error' : ''}`} value={form.category} onChange={handleChange}>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              {fieldError('category')}
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-worktype">Work type</label>
              <select id="post-worktype" name="workType" className="input" value={form.workType} onChange={handleChange}>
                {workTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-emptype">Employment type</label>
              <select id="post-emptype" name="employmentType" className="input" value={form.employmentType} onChange={handleChange}>
                {employmentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-exp">Experience level</label>
              <select id="post-exp" name="experienceLevel" className="input" value={form.experienceLevel} onChange={handleChange}>
                {experienceLevels.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
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
/* Applications tab — recruiter-only list of applicants for their own jobs  */
/* ======================================================================= */
function ApplicationsTab() {
  const { user } = useAuth();
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobFilter, setJobFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiGet('/applications/mine');
        if (!cancelled) setApplications(res.data?.applications || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Unable to load your applications.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="app-loading" aria-busy="true" />;

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtTimeAgo = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return fmtDate(dateStr);
  };

  const PIPELINE = ['applied', 'under-review', 'interview', 'offer', 'hired'];

  const countByStatus = (list) => {
    const c = {};
    for (const s of PIPELINE) c[s] = 0;
    c.rejected = 0;
    for (const app of list) {
      if (c[app.status] !== undefined) c[app.status]++;
      else if (app.status === 'rejected') c.rejected++;
    }
    return c;
  };

  const uniqueJobs = [];
  const seenJobIds = new Set();
  for (const app of applications) {
    const jid = app.job?.id || app.job?._id;
    if (jid && !seenJobIds.has(String(jid))) {
      seenJobIds.add(String(jid));
      uniqueJobs.push({ id: String(jid), title: app.job?.title || 'Job' });
    }
  }

  const filtered = jobFilter === 'all'
    ? applications
    : applications.filter((app) => String(app.job?.id || app.job?._id) === jobFilter);

  const metrics = countByStatus(filtered);
  const total = filtered.length;

  const jobsByCount = [];
  const jobCountMap = new Map();
  for (const app of applications) {
    const jid = app.job?.id || app.job?._id;
    const key = String(jid);
    if (!jobCountMap.has(key)) {
      jobCountMap.set(key, { title: app.job?.title || 'Job', company: app.job?.company || '', count: 0 });
    }
    jobCountMap.get(key).count++;
  }
  for (const [, v] of jobCountMap) jobsByCount.push(v);
  jobsByCount.sort((a, b) => b.count - a.count);

  const maxJobCount = jobsByCount.length > 0 ? Math.max(...jobsByCount.map((j) => j.count)) : 1;

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const recruiterName = (user?.fullName || '').split(' ')[0] || '';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const stageColors = {
    applied: '#4F46E5',
    'under-review': '#6B7280',
    interview: '#7C3AED',
    offer: '#059669',
    hired: '#10B981',
  };

  if (total === 0 && !error) {
    return (
      <div className="rc-dashboard">
        <div className="rc-header">
          <div className="rc-header-text">
            <h1 className="rc-header-title">{greeting}{recruiterName ? `, ${recruiterName}` : ''}</h1>
            <p className="rc-header-sub">Your hiring workspace — track candidates and manage your pipeline.</p>
          </div>
        </div>
        <div className="rc-empty-state">
          <div className="rc-empty-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="rc-empty-title">No applications yet</h3>
          <p className="rc-empty-desc">
            When jobseekers apply to the jobs you post, their applications will appear here.
            You can start by posting a new job.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rc-dashboard">
      {/* ── Header / Workspace Context ───────────────────────── */}
      <div className="rc-header">
        <div className="rc-header-text">
          <h1 className="rc-header-title">{greeting}{recruiterName ? `, ${recruiterName}` : ''}</h1>
          <p className="rc-header-sub">Your hiring workspace — track candidates and manage your pipeline.</p>
        </div>
        {uniqueJobs.length > 1 && (
          <div className="rc-job-filter">
            <label className="rc-filter-label" htmlFor="rc-job-select">Filter by job</label>
            <select
              id="rc-job-select"
              className="input rc-filter-select"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
            >
              <option value="all">All jobs</option>
              {uniqueJobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}

      {/* ── Metric Cards ─────────────────────────────────────── */}
      <div className="rc-metrics">
        <div className="rc-metric-card rc-metric--blue">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="rc-metric-label">Total applicants</span>
          </div>
          <div className="rc-metric-value">{total}</div>
          <div className="rc-metric-context">{total === 1 ? 'candidate' : 'candidates'} across all jobs</div>
          <div className="rc-metric-distribution" aria-hidden="true">
            {PIPELINE.map((s) => {
              const w = total > 0 ? (metrics[s] / total) * 100 : 0;
              return w > 0 ? <div key={s} className="rc-metric-dist-seg" style={{ flex: w, backgroundColor: stageColors[s] }} /> : null;
            })}
            {total > 0 && (
              <div className="rc-metric-dist-seg" style={{ flex: metrics.rejected > 0 ? (metrics.rejected / total) * 100 : 0.5, backgroundColor: '#E5E7EB' }} />
            )}
          </div>
        </div>

        <div className="rc-metric-card rc-metric--indigo">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span className="rc-metric-label">Under review</span>
          </div>
          <div className="rc-metric-value">{metrics['under-review']}</div>
          <div className="rc-metric-context">actively being screened</div>
          <div className="rc-metric-progress-track" aria-hidden="true">
            <div className="rc-metric-progress-fill rc-metric-progress-fill--indigo" style={{ width: total > 0 ? `${(metrics['under-review'] / total) * 100}%` : '0%' }} />
          </div>
        </div>

        <div className="rc-metric-card rc-metric--purple">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M14 9l-2 2-2-2" />
              </svg>
            </div>
            <span className="rc-metric-label">Interviews</span>
          </div>
          <div className="rc-metric-value">{metrics['interview']}</div>
          <div className="rc-metric-context">scheduled conversations</div>
          <div className="rc-metric-progress-track" aria-hidden="true">
            <div className="rc-metric-progress-fill rc-metric-progress-fill--purple" style={{ width: total > 0 ? `${(metrics['interview'] / total) * 100}%` : '0%' }} />
          </div>
        </div>

        <div className="rc-metric-card rc-metric--green">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <span className="rc-metric-label">Offers &amp; hired</span>
          </div>
          <div className="rc-metric-value">{metrics['offer'] + metrics['hired']}</div>
          <div className="rc-metric-context">successful placements</div>
          <div className="rc-metric-progress-track" aria-hidden="true">
            <div className="rc-metric-progress-fill rc-metric-progress-fill--green" style={{ width: total > 0 ? `${((metrics['offer'] + metrics['hired']) / total) * 100}%` : '0%' }} />
          </div>
        </div>
      </div>

      {/* ── Main Content: Pipeline + Insights ────────────────── */}
      <div className="rc-content-grid">
        {/* Hiring Pipeline — Hero Panel */}
        <div className="rc-pipeline">
          <div className="rc-pipeline-header">
            <h2 className="rc-panel-title">Hiring pipeline</h2>
            <span className="rc-pipeline-total">{total} total applications</span>
          </div>
          <div className="rc-pipeline-funnel">
            {PIPELINE.map((s, i) => {
              const pct = total > 0 ? Math.round((metrics[s] / total) * 100) : 0;
              const barWidth = total > 0 ? (metrics[s] / total) * 100 : 0;
              return (
                <div className="rc-funnel-step" key={s}>
                  <div className="rc-funnel-visual">
                    <div className="rc-funnel-bar" style={{ width: `${Math.max(barWidth, metrics[s] > 0 ? 8 : 2)}%`, backgroundColor: stageColors[s] }} />
                  </div>
                  <div className="rc-funnel-meta">
                    <div className="rc-funnel-stage-row">
                      <span className="rc-funnel-dot" style={{ backgroundColor: stageColors[s] }} />
                      <span className="rc-funnel-stage-name">{STATUS_LABELS[s]}</span>
                      <span className="rc-funnel-count">{metrics[s]}</span>
                    </div>
                    {total > 0 && <span className="rc-funnel-pct">{pct}%</span>}
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div className="rc-funnel-connector" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>

          {metrics.rejected > 0 && (
            <div className="rc-pipeline-rejected">
              <span className="rc-rejected-dot" />
              {metrics.rejected} {metrics.rejected === 1 ? 'applicant' : 'applicants'} rejected
            </div>
          )}
        </div>

        {/* Insights Column */}
        <div className="rc-insights">
          {/* Applications by Job */}
          <div className="rc-insight-panel">
            <h3 className="rc-insight-title">Applications by job</h3>
            <div className="rc-jobs-list">
              {jobsByCount.map((j, i) => (
                <div className="rc-job-row" key={i}>
                  <div className="rc-job-row-head">
                    <span className="rc-job-rank">{i + 1}</span>
                    <span className="rc-job-row-title">{j.title}</span>
                    <span className="rc-job-row-count">{j.count}</span>
                  </div>
                  <div className="rc-job-bar-track">
                    <div
                      className="rc-job-bar-fill"
                      style={{ width: `${maxJobCount > 0 ? (j.count / maxJobCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              {jobsByCount.length === 0 && (
                <p className="rc-insight-empty">No job applications yet</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rc-insight-panel rc-insight-panel--activity">
            <h3 className="rc-insight-title">Recent activity</h3>
            <div className="rc-activity-timeline">
              {recentApps.map((app, idx) => (
                <div className="rc-activity-entry" key={app.id}>
                  {idx < recentApps.length - 1 && <div className="rc-activity-line" aria-hidden="true" />}
                  <div className="rc-activity-dot" aria-hidden="true">
                    <div className="rc-activity-avatar-sm">
                      {app.applicant?.avatarUrl ? (
                        <img src={`${AVATAR_BASE}${app.applicant.avatarUrl}`} alt="" />
                      ) : (
                        (app.applicant?.fullName || 'A').charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                  <div className="rc-activity-content">
                    <div className="rc-activity-text">
                      <span className="rc-activity-name">{app.applicant?.fullName || 'Applicant'}</span>
                      <span className="rc-activity-action">applied to</span>
                      <span className="rc-activity-job">{app.job?.title || 'a job'}</span>
                    </div>
                    <span className="rc-activity-time">{fmtTimeAgo(app.createdAt)}</span>
                  </div>
                </div>
              ))}
              {recentApps.length === 0 && (
                <p className="rc-insight-empty">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Applicants Workspace ──────────────────────────────── */}
      <div className="rc-applicants">
        <div className="rc-applicants-header">
          <h2 className="rc-panel-title">Applicants</h2>
          <span className="rc-applicants-count">{total} {total === 1 ? 'candidate' : 'candidates'}</span>
        </div>
        <div className="rc-table-header">
          <span className="rc-th rc-th--candidate">Candidate</span>
          <span className="rc-th rc-th--job">Job</span>
          <span className="rc-th rc-th--date">Applied</span>
          <span className="rc-th rc-th--status">Status</span>
        </div>
        <div className="rc-table-body">
          {filtered.map((app) => (
            <div className="rc-table-row" key={app.id}>
              <div className="rc-td rc-td--candidate">
                <div className="rc-candidate-avatar" aria-hidden="true">
                  {app.applicant?.avatarUrl ? (
                    <img src={`${AVATAR_BASE}${app.applicant.avatarUrl}`} alt="" />
                  ) : (
                    (app.applicant?.fullName || 'A').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="rc-candidate-info">
                  <strong className="rc-candidate-name">{app.applicant?.fullName || 'Applicant'}</strong>
                  {app.applicant?.headline && (
                    <span className="rc-candidate-role">{app.applicant.headline}</span>
                  )}
                </div>
              </div>
              <div className="rc-td rc-td--job">
                <span className="rc-td-job-title">{app.job?.title || 'Job'}</span>
                <span className="rc-td-job-meta">
                  {app.job?.company}
                  {app.job?.location ? ` · ${app.job.location}` : ''}
                </span>
              </div>
              <span className="rc-td rc-td--date">{fmtDate(app.createdAt)}</span>
              <div className="rc-td rc-td--status">
                <span className={`badge application-status application-status--${app.status}`}>
                  {STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const formatSalary = (salary) => {
  if (!salary || (salary.min === undefined && salary.max === undefined)) return 'Salary on application';
  if (salary.period === 'hourly') {
    return `$${salary.min}–$${salary.max}/hr`;
  }
  const fmt = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  if (salary.min !== undefined && salary.max !== undefined) {
    return `${fmt(salary.min)} – ${fmt(salary.max)}`;
  }
  if (salary.min !== undefined) return `From ${fmt(salary.min)}`;
  return `Up to ${fmt(salary.max)}`;
};

const STATUS_LABELS = {
  applied: 'Applied',
  'under-review': 'Under review',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

/* ======================================================================= */
/* Jobseeker Applications tab — the current jobseeker's own applications    */
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
          <h1 className="profile-title">Your applications</h1>
          <p className="profile-subtitle">Track the jobs you've applied to and their current status.</p>
        </div>
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}

      {!error && applications.length === 0 && (
        <div className="js-empty-state">
          <div className="js-empty-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <h3 className="js-empty-title">No applications yet</h3>
          <p className="js-empty-desc">
            When you apply to a job, it will show up here so you can track its status. Start exploring roles on Find Jobs.
          </p>
          <Link to="/" className="btn btn-primary">Browse jobs</Link>
        </div>
      )}

      {applications.length > 0 && (
        <div className="js-application-list">
          {applications.map((app) => (
            <div className="js-application-card" key={app.id}>
              <div className="js-application-main">
                <div className="js-application-avatar" aria-hidden="true">
                  {(app.job?.company || 'C').charAt(0)}
                </div>
                <div className="js-application-info">
                  <strong className="js-application-title">{app.job?.title || 'Job'}</strong>
                  <span className="js-application-company">
                    {app.job?.company || '—'}
                    {app.job?.location ? ` · ${app.job.location}` : ''}
                  </span>
                  <span className={`badge application-status application-status--${app.status}`}>
                    {STATUS_LABELS[app.status] || app.status}
                  </span>
                </div>
              </div>
              <div className="js-application-side">
                <span className="js-application-date">Applied on · {fmtDate(app.createdAt)}</span>
                {app.job?.id && (
                  <Link to={`/jobs/${app.job.id}`} className="btn btn-sm btn-secondary js-application-open">
                    View job
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ======================================================================= */
/* Saved Jobs tab — the current jobseeker's saved jobs                      */
/* ======================================================================= */
function SavedJobsTab() {
  const [savedJobs, setSavedJobs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiGet('/saved-jobs');
        if (!cancelled) setSavedJobs(res.data?.savedJobs || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Unable to load your saved jobs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (jobId) => {
    if (removing[jobId]) return;
    setRemoving((prev) => ({ ...prev, [jobId]: true }));
    try {
      await apiDelete(`/saved-jobs/${jobId}`);
      setSavedJobs((prev) => prev.filter((j) => String(j.id) !== String(jobId)));
    } catch (err) {
      setError(err?.message || 'Unable to remove this job.');
      setRemoving((prev) => { const next = { ...prev }; delete next[jobId]; return next; });
    }
  };

  if (loading) {
    return <div className="app-loading" aria-busy="true" />;
  }

  return (
    <div className="card profile-form js-saved-tab">
      <div className="profile-header">
        <div className="profile-header-text">
          <h1 className="profile-title">Saved jobs</h1>
          <p className="profile-subtitle">Jobs you've saved for later. Apply or remove them anytime.</p>
        </div>
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}

      {!error && savedJobs.length === 0 && (
        <div className="js-empty-state">
          <div className="js-empty-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 className="js-empty-title">No saved jobs yet</h3>
          <p className="js-empty-desc">
            Hit the bookmark on any job you find interesting and it will be saved here for easy access later.
          </p>
          <Link to="/" className="btn btn-primary">Find jobs</Link>
        </div>
      )}

      {savedJobs.length > 0 && (
        <div className="js-saved-list">
          {savedJobs.map((job) => (
            <div className="js-saved-card" key={job.id}>
              <div className="js-saved-top">
                <div className="js-saved-avatar" aria-hidden="true">
                  {(job.company || 'C').charAt(0)}
                </div>
                <div className="js-saved-info">
                  <Link to={`/jobs/${job.id}`} className="js-saved-title">{job.title}</Link>
                  <span className="js-saved-company">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ''}
                  </span>
                </div>
                <span className="js-saved-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  Saved
                </span>
              </div>
              <div className="js-saved-meta">
                {job.workType && <span className="badge badge-neutral">{job.workType}</span>}
                {job.employmentType && <span className="badge badge-neutral">{job.employmentType}</span>}
                {job.experienceLevel && <span className="badge badge-neutral">{job.experienceLevel}</span>}
                <span className="js-saved-salary">{formatSalary(job.salary)}</span>
              </div>
              <div className="js-saved-actions">
                <Link to={`/jobs/${job.id}`} className="btn btn-sm btn-secondary">View job</Link>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost js-saved-remove"
                  onClick={() => handleRemove(job.id)}
                  disabled={removing[job.id]}
                >
                  {removing[job.id] ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

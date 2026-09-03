import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPatch, apiUpload } from '../utils/api';
import { categories, workTypes, employmentTypes, experienceLevels } from '../data/mockData';
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
                aria-selected={tab === 'applications'}
                className={`profile-tab ${tab === 'applications' ? 'active' : ''}`}
                onClick={() => setTab('applications')}
              >
                Applications
              </button>
            </>
          )}
        </div>

        {tab === 'post' ? (
          <PostJobTab />
        ) : tab === 'applications' ? (
          <ApplicationsTab />
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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({});
  const [draftLink, setDraftLink] = useState({ label: '', url: '' });

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
    setSuccess('');
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
      setSuccess('Profile saved successfully.');
    } catch (err) {
      setError(err?.message || 'Unable to save your profile.');
      if (err?.data?.fieldErrors) {
        setFieldErrors(err.data.fieldErrors);
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
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await apiUpload('/profile/upload/avatar', fd);
      const updated = res.data;
      setProfile(updated);
      setForm(updated);
      setSuccess('Profile picture updated.');
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
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const res = await apiUpload('/profile/upload/resume', fd);
      const updated = res.data;
      setProfile(updated);
      setForm(updated);
      setSuccess('Resume uploaded.');
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
          <span className="section-eyebrow">Your profile</span>
          <h1 className="profile-title">{isRecruiter ? 'Recruiter profile' : 'Jobseeker profile'}</h1>
          <p className="profile-subtitle">
            {profile
              ? 'Keep your details up to date so recruiters and candidates can find you.'
              : 'Tell HireFlow a bit about yourself to get started.'}
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
      {success && (
        <div className="auth-alert auth-alert-success" role="status">
          <span>{success}</span>
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
              {form.experience && form.experience.length > 0 ? (
                <div className="profile-list">
                  {form.experience.map((exp, i) => (
                    <div className="profile-list-item" key={i}>
                      <div><strong>{exp.title}</strong> at {exp.company}</div>
                      {exp.description && <p>{exp.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty">No experience added yet.</p>
              )}
              {fieldError('experience')}
            </fieldset>
          </>
        )}

        <div className="profile-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Saving…' : profile ? 'Save changes' : 'Create profile'}
          </button>
          {isRecruiter && (
            <Link to="/profile?tab=post" className="btn btn-secondary btn-lg">Post a job</Link>
          )}
        </div>
      </form>
    </>
  );
}

/* ======================================================================= */
/* Post a job tab — recruiter-only                                          */
/* ======================================================================= */
function PostJobTab() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
      setSuccess('Job posted successfully!');
      setForm({ ...form, title: '', location: '', salaryMin: '', salaryMax: '', skills: '', description: '' });
    } catch (err) {
      setError(err?.message || 'Unable to post the job.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card profile-form">
      <div className="profile-header">
        <div className="profile-header-text">
          <span className="section-eyebrow">Recruiter</span>
          <h1 className="profile-title">Post a job</h1>
          <p className="profile-subtitle">Share a new role and start receiving applicants.</p>
        </div>
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}
      {success && <div className="auth-alert auth-alert-success" role="status"><span>{success}</span></div>}

      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="profile-fieldset">
          <legend className="profile-fieldset-title">Role details</legend>
          <div className="profile-grid">
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-title">Job title <span aria-hidden="true">*</span></label>
              <input id="post-title" name="title" className="input" value={form.title} onChange={handleChange} required placeholder="Senior Frontend Engineer" />
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-company">Company <span aria-hidden="true">*</span></label>
              <input id="post-company" name="company" className="input" value={form.company} onChange={handleChange} required placeholder="Acme Corp" />
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-location">Location</label>
              <input id="post-location" name="location" className="input" value={form.location} onChange={handleChange} placeholder="Remote / San Francisco, CA" />
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="post-category">Category</label>
              <select id="post-category" name="category" className="input" value={form.category} onChange={handleChange}>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
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
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Posting…' : 'Post job'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ======================================================================= */
/* Applications tab — recruiter-only list of applicants for their own jobs  */
/* ======================================================================= */
function ApplicationsTab() {
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    <div className="card profile-form">
      <div className="profile-header">
        <div className="profile-header-text">
          <span className="section-eyebrow">Recruiter</span>
          <h1 className="profile-title">Applications</h1>
          <p className="profile-subtitle">Candidates who have applied to your posted jobs.</p>
        </div>
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}

      {!error && applications.length === 0 && (
        <div className="applications-empty">
          <p className="profile-empty">No applications yet.</p>
          <p className="profile-hint">
            When jobseekers apply to the jobs you post, their applications will appear here.
          </p>
        </div>
      )}

      {applications.length > 0 && (
        <div className="applications-list">
          {applications.map((app) => (
            <div className="application-card" key={app.id}>
              <div className="application-applicant">
                <div className="application-avatar" aria-hidden="true">
                  {app.applicant?.avatarUrl ? (
                    <img src={`${AVATAR_BASE}${app.applicant.avatarUrl}`} alt="" />
                  ) : (
                    (app.applicant?.fullName || 'A').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="application-applicant-info">
                  <strong className="application-name">{app.applicant?.fullName || 'Applicant'}</strong>
                  {app.applicant?.headline && (
                    <span className="application-headline">{app.applicant.headline}</span>
                  )}
                </div>
              </div>

              <div className="application-job">
                <span className="application-job-title">{app.job?.title || 'Job'}</span>
                <span className="application-company">
                  {app.job?.company}
                  {app.job?.location ? ` · ${app.job.location}` : ''}
                </span>
              </div>

              <div className="application-meta">
                <span className="badge badge-neutral">Applied {fmtDate(app.createdAt)}</span>
                <span className={`badge application-status application-status--${app.status}`}>
                  {app.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

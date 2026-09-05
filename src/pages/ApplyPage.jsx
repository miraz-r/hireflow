import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJobById } from '../utils/jobsApi';
import api from '../utils/api';
import './ApplyPage.css';

export default function ApplyPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Redirect if not logged in or not a jobseeker
  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
    if (!loading && user && user.role !== 'jobseeker') navigate(`/jobs/${id}`, { replace: true });
  }, [user, loading, id, navigate]);

  // Fetch job
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJobById(id).then((data) => {
      if (cancelled) return;
      setJob(data);
      setLoading(false);
      if (!data) {
        setTimeout(() => navigate('/', { replace: true }), 2000);
      }
    });
    return () => { cancelled = true; };
  }, [id, navigate]);

  // Fetch profile to prefill form
  useEffect(() => {
    if (!user || user.role !== 'jobseeker') return;
    let cancelled = false;
    setProfileLoading(true);
    api.get('/profile', { timeout: 5000 })
      .then((res) => {
        if (cancelled) return;
        const p = res.data;
        setProfile(p);
        setFullName(p.fullName || '');
        setEmail(user.email || '');
        setPhone(p.phone || '');
        if (Array.isArray(p.links)) {
          const linkedIn = p.links.find((l) => /linkedin/i.test(l.label));
          if (linkedIn) setLinkedin(linkedIn.url);
          const portfolioLink = p.links.find((l) => /portfolio|website|github/i.test(l.label));
          if (portfolioLink) setPortfolio(portfolioLink.url);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEmail(user.email || '');
        setFullName(user.fullName || '');
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  // Check if already applied
  useEffect(() => {
    if (!user || user.role !== 'jobseeker' || !job?.id) return;
    let cancelled = false;
    api.get(`/applications/${job.id}/me`, { timeout: 4000 })
      .then((res) => {
        if (!cancelled && res.data?.applied) {
          setAlreadyApplied(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, job?.id]);

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    if (!phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (!/^[+0-9()\-\s]{6,32}$/.test(phone.trim())) {
      errs.phone = 'Enter a valid phone number';
    }
    if (!profile?.resumeUrl) {
      errs.resume = 'A resume is required. Upload one in your profile.';
    }
    if (linkedin.trim() && !/^https?:\/\/.+\..+/.test(linkedin.trim())) {
      errs.linkedin = 'Enter a valid URL starting with http:// or https://';
    }
    if (portfolio.trim() && !/^https?:\/\/.+\..+/.test(portfolio.trim())) {
      errs.portfolio = 'Enter a valid URL starting with http:// or https://';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setError('');
    try {
      await api.post('/applications', {
        jobId: job.id,
        coverLetter: coverLetter.trim(),
        phone: phone.trim(),
        resumeUrl: profile?.resumeUrl || '',
      }, { timeout: 10000 });
      setSubmitted(true);
    } catch (err) {
      if (err.status === 409) {
        setAlreadyApplied(true);
      } else {
        setError(err?.message || 'Unable to submit your application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const clearFieldError = (name) => {
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="apply-page">
        <div className="container">
          <div className="apply-loading" aria-busy="true">Loading…</div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="apply-page">
        <div className="container">
          <div className="apply-empty">
            <h1>Job not found</h1>
            <p>The job you're looking for doesn't exist or was removed.</p>
            <Link to="/" className="btn btn-primary">Browse jobs</Link>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyApplied) {
    return (
      <div className="apply-page">
        <div className="container">
          <div className="apply-card">
            <div className="apply-success-state">
              <div className="apply-success-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 className="apply-success-title">Already applied</h2>
              <p className="apply-success-desc">
                You've already applied to {job.title} at {job.company}.
              </p>
              <div className="apply-success-actions">
                <Link to={`/jobs/${job.id}`} className="btn btn-secondary">View job</Link>
                <Link to="/" className="btn btn-primary">Browse jobs</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="apply-page">
        <div className="container">
          <div className="apply-card">
            <div className="apply-success-state">
              <div className="apply-success-icon apply-success-icon--done" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 className="apply-success-title">Application submitted</h2>
              <p className="apply-success-desc">
                Your application for {job.title} at {job.company} has been submitted.
              </p>
              <div className="apply-success-actions">
                <Link to={`/jobs/${job.id}`} className="btn btn-secondary">View job</Link>
                <Link to="/" className="btn btn-primary">Browse jobs</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="apply-page">
      <div className="container">
        <Link to={`/jobs/${job.id}`} className="apply-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to job
        </Link>

        <div className="apply-card">
          <header className="apply-job-header">
            <div className="apply-job-avatar" aria-hidden="true">
              {job.company.charAt(0)}
            </div>
            <div className="apply-job-info">
              <h1 className="apply-job-title">Apply for {job.title}</h1>
              <span className="apply-job-company">
                {job.company}
                {job.location ? ` · ${job.location}` : ''}
              </span>
            </div>
          </header>

          <form className="apply-form" onSubmit={handleSubmit} noValidate>
            <fieldset className="apply-fieldset">
              <legend className="apply-fieldset-title">Your information</legend>

              <div className="apply-grid">
                <div className="apply-field">
                  <label className="apply-label" htmlFor="apply-fullName">
                    Full name <span className="apply-required">*</span>
                  </label>
                  <input
                    id="apply-fullName"
                    type="text"
                    className={`input ${fieldErrors.fullName ? 'input-error' : ''}`}
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearFieldError('fullName'); }}
                    autoComplete="name"
                  />
                  {fieldErrors.fullName && <span className="apply-field-error" role="alert">{fieldErrors.fullName}</span>}
                </div>

                <div className="apply-field">
                  <label className="apply-label" htmlFor="apply-email">
                    Email <span className="apply-required">*</span>
                  </label>
                  <input
                    id="apply-email"
                    type="email"
                    className={`input ${fieldErrors.email ? 'input-error' : ''}`}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                    autoComplete="email"
                  />
                  {fieldErrors.email && <span className="apply-field-error" role="alert">{fieldErrors.email}</span>}
                </div>

                <div className="apply-field">
                  <label className="apply-label" htmlFor="apply-phone">
                    Phone number <span className="apply-required">*</span>
                  </label>
                  <input
                    id="apply-phone"
                    type="tel"
                    className={`input ${fieldErrors.phone ? 'input-error' : ''}`}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); clearFieldError('phone'); }}
                    autoComplete="tel"
                  />
                  {fieldErrors.phone && <span className="apply-field-error" role="alert">{fieldErrors.phone}</span>}
                </div>
              </div>
            </fieldset>

            <fieldset className="apply-fieldset">
              <legend className="apply-fieldset-title">Resume</legend>

              <div className="apply-field">
                <label className="apply-label" htmlFor="apply-resume">
                  Resume / CV <span className="apply-required">*</span>
                </label>
                {profileLoading ? (
                  <span className="apply-resume-loading">Loading…</span>
                ) : profile?.resumeName ? (
                  <div className={`apply-resume-display ${fieldErrors.resume ? 'apply-resume-display--error' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="apply-resume-name">{profile.resumeName}</span>
                  </div>
                ) : (
                  <div className="apply-resume-missing">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>No resume uploaded. <Link to="/profile">Upload one in your profile</Link>.</span>
                  </div>
                )}
                {fieldErrors.resume && <span className="apply-field-error" role="alert">{fieldErrors.resume}</span>}
              </div>
            </fieldset>

            <fieldset className="apply-fieldset">
              <legend className="apply-fieldset-title">Cover letter</legend>

              <div className="apply-field">
                <label className="apply-label" htmlFor="apply-coverLetter">
                  Cover letter
                </label>
                <textarea
                  id="apply-coverLetter"
                  className="input apply-textarea"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Tell the employer why you're a great fit…"
                  rows={6}
                />
                <span className="apply-field-hint">Optional — max 5000 characters</span>
              </div>
            </fieldset>

            <fieldset className="apply-fieldset">
              <legend className="apply-fieldset-title">Professional links</legend>

              <div className="apply-grid">
                <div className="apply-field">
                  <label className="apply-label" htmlFor="apply-linkedin">
                    LinkedIn
                  </label>
                  <input
                    id="apply-linkedin"
                    type="url"
                    className={`input ${fieldErrors.linkedin ? 'input-error' : ''}`}
                    value={linkedin}
                    onChange={(e) => { setLinkedin(e.target.value); clearFieldError('linkedin'); }}
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                  {fieldErrors.linkedin && <span className="apply-field-error" role="alert">{fieldErrors.linkedin}</span>}
                </div>

                <div className="apply-field">
                  <label className="apply-label" htmlFor="apply-portfolio">
                    Portfolio / Website
                  </label>
                  <input
                    id="apply-portfolio"
                    type="url"
                    className={`input ${fieldErrors.portfolio ? 'input-error' : ''}`}
                    value={portfolio}
                    onChange={(e) => { setPortfolio(e.target.value); clearFieldError('portfolio'); }}
                    placeholder="https://yourportfolio.com"
                  />
                  {fieldErrors.portfolio && <span className="apply-field-error" role="alert">{fieldErrors.portfolio}</span>}
                </div>
              </div>
            </fieldset>

            {error && (
              <div className="apply-submit-error" role="alert">{error}</div>
            )}

            <div className="apply-actions">
              <Link to={`/jobs/${job.id}`} className="btn btn-secondary">
                Back
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

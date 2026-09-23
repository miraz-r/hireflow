import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJobById } from '../utils/jobsApi';
import { getJobsScroll } from '../utils/jobsScrollState';
import api from '../utils/api';
import { formatSalary } from '../utils/salary';
import { STATUS_LABELS } from '../constants/applicationStatus';
import './JobDetailPage.css';

export default function JobDetailPage({ onSignInPrompt }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromApplications = location.state?.from === 'applications';
  const fromSaved = location.state?.from === 'saved';
  const handleBack = () => {
    if (fromApplications) {
      navigate('/profile?tab=my-applications');
      return;
    }
    if (fromSaved) {
      navigate('/saved-jobs');
      return;
    }
    const bookmark = getJobsScroll();
    navigate('/', { state: { restoreJobsScroll: bookmark?.scrollY ?? null } });
  };
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [checkingSaved, setCheckingSaved] = useState(false);

  const isJobseeker = user?.role === 'jobseeker';
  const notFoundTimerRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJobById(id).then((data) => {
      if (cancelled) return;
      setJob(data);
      setLoading(false);
      if (!data) {
        notFoundTimerRef.current = setTimeout(() => {
          notFoundTimerRef.current = null;
          navigate('/', { replace: true });
        }, 2000);
      }
    });
    return () => {
      cancelled = true;
      if (notFoundTimerRef.current) {
        clearTimeout(notFoundTimerRef.current);
        notFoundTimerRef.current = null;
      }
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!job?.id) return;
    if (!user || user.role !== 'jobseeker') {
      setApplied(false);
      setApplicationStatus(null);
      return;
    }
    let cancelled = false;
    api
      .get(`/applications/${job.id}/me`, { timeout: 4000 })
      .then((res) => {
        if (cancelled) return;
        const appliedServer = !!res.data?.applied;
        setApplied(appliedServer);
        if (appliedServer && res.data?.application?.status) {
          setApplicationStatus(res.data.application.status);
        } else {
          setApplicationStatus(null);
        }
      })
      .catch(() => {
        if (!cancelled) setApplied(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job?.id, user]);

  useEffect(() => {
    if (!job?.id) return;
    if (!user || user.role !== 'jobseeker') {
      setSaved(false);
      setCheckingSaved(false);
      return;
    }
    let cancelled = false;
    setCheckingSaved(true);
    api
      .get(`/saved-jobs/check/${job.id}`, { timeout: 4000 })
      .then((res) => {
        if (!cancelled) setSaved(!!res.data?.saved);
      })
      .catch(() => {
        if (!cancelled) setSaved(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job?.id, user]);

  if (loading) {
    return (
      <div className="job-detail-page">
        <div className="container">
          <div className="job-detail-loading" aria-busy="true">Loading job…</div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="job-detail-page">
        <div className="container">
          <div className="card job-detail-empty">
            <h1>Job not found</h1>
            <p>The job you're looking for doesn't exist or was removed.</p>
            <Link to="/" className="btn btn-primary">Browse jobs</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!user) {
      onSignInPrompt && onSignInPrompt();
      return;
    }
    if (!isJobseeker || savingJob) return;

    setSavingJob(true);
    try {
      if (saved) {
        await api.delete(`/saved-jobs/${job.id}`, { timeout: 8000 });
        setSaved(false);
      } else {
        await api.post('/saved-jobs', { jobId: job.id }, { timeout: 8000 });
        setSaved(true);
      }
    } catch {
      // save failed
    } finally {
      setSavingJob(false);
    }
  };

  const showSaveButton = user?.role !== 'recruiter';
  let saveButtonLabel = saved ? 'Saved' : 'Save';
  if (savingJob) saveButtonLabel = saved ? 'Unsaving…' : 'Saving…';

  return (
    <div className="job-detail-page">
      <div className="container">
        <button
          type="button"
          className="job-detail-back-link"
          onClick={handleBack}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {fromApplications ? 'Back to applications' : fromSaved ? 'Back to Saved Jobs' : 'Back to all jobs'}
        </button>

        <div className="job-detail-layout">
          <div className="job-detail-main">
            <header className="job-detail-header">
              <div className="job-detail-header-top">
                <div className="job-detail-company-info">
                  <div className="job-detail-avatar" aria-hidden="true">
                    {job.company.charAt(0)}
                  </div>
                  <div className="job-detail-heading">
                    <h1 className="job-detail-title">{job.title}</h1>
                    <div className="job-detail-company-row">
                      <span className="job-detail-company-name">{job.company}</span>
                      <span className="job-detail-separator">·</span>
                      <span className="job-detail-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        {job.location}
                      </span>
                    </div>
                  </div>
                </div>

                {showSaveButton && (
                  <button
                    type="button"
                    className={`job-detail-save-btn ${saved ? 'saved' : ''}`}
                    onClick={handleSave}
                    disabled={savingJob || checkingSaved}
                    aria-pressed={saved}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span className="job-detail-save-label">{saveButtonLabel}</span>
                  </button>
                )}
              </div>

              <div className="job-detail-tags">
                <span className={`badge badge-${job.workType === 'Remote' ? 'success' : job.workType === 'Hybrid' ? 'primary' : 'neutral'}`}>
                  {job.workType}
                </span>
                <span className="badge badge-neutral">{job.employmentType}</span>
                <span className="badge badge-neutral">{job.experienceLevel}</span>
              </div>
            </header>

            <section className="job-detail-section">
              <h2 className="job-detail-section-title">About the role</h2>
              <div className="job-detail-description">{job.description}</div>
            </section>

            {job.skills && job.skills.length > 0 && (
              <section className="job-detail-section">
                <h2 className="job-detail-section-title">Skills</h2>
                <div className="job-detail-skills">
                  {job.skills.map((skill) => (
                    <span key={skill} className="job-detail-skill-chip">{skill}</span>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="job-detail-side">
            <div className="job-detail-sidebar-card">
              <div className="job-detail-summary-list">
                <div className="job-detail-summary-row">
                  <span className="job-detail-summary-label">Salary</span>
                  <span className="job-detail-summary-value">{formatSalary(job.salary)}</span>
                </div>
                <div className="job-detail-summary-row">
                  <span className="job-detail-summary-label">Location</span>
                  <span className="job-detail-summary-value">{job.location}</span>
                </div>
                <div className="job-detail-summary-row">
                  <span className="job-detail-summary-label">Work type</span>
                  <span className="job-detail-summary-value">{job.workType}</span>
                </div>
                <div className="job-detail-summary-row">
                  <span className="job-detail-summary-label">Employment</span>
                  <span className="job-detail-summary-value">{job.employmentType}</span>
                </div>
                <div className="job-detail-summary-row">
                  <span className="job-detail-summary-label">Experience</span>
                  <span className="job-detail-summary-value">{job.experienceLevel}</span>
                </div>
                <div className="job-detail-summary-row">
                  <span className="job-detail-summary-label">Category</span>
                  <span className="job-detail-summary-value">{job.category}</span>
                </div>
              </div>

              <div className="job-detail-sidebar-actions">
                {applied && (
                  <>
                    <p className="job-detail-applied-note">
                      {applicationStatus && STATUS_LABELS[applicationStatus]
                        ? `Status: ${STATUS_LABELS[applicationStatus]}`
                        : 'Your application has been submitted.'}
                    </p>
                  </>
                )}

                {!applied && !user && (
                  <button
                    className="btn btn-lg btn-primary job-detail-apply-btn"
                    onClick={() => navigate('/login')}
                  >
                    Sign in to apply
                  </button>
                )}

                {!applied && user && isJobseeker && (
                  <Link
                    to={`/jobs/${job.id}/apply`}
                    className="btn btn-lg btn-primary job-detail-apply-btn"
                  >
                    Apply
                  </Link>
                )}

                {!applied && user && !isJobseeker && (
                  <p className="job-detail-apply-hint">
                    Switch to a jobseeker account to apply.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

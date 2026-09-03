import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJobById } from '../utils/jobsApi';
import api from '../utils/api';
import './JobDetailPage.css';

const formatSalary = (salary) => {
  if (!salary) return 'Salary on application';
  if (salary.period === 'hourly') {
    return `$${salary.min}–$${salary.max}/hr`;
  }
  const fmt = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  return `${fmt(salary.min)} – ${fmt(salary.max)}`;
};

export default function JobDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState('');

  const isJobseeker = user?.role === 'jobseeker';

  // Return to the job list reliably. Prefer browser history when it points
  // back to a job list (homepage), otherwise fall back to the homepage.
  const handleBack = () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

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
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // Restore the applied state from the backend after a refresh (jobseeker only).
  useEffect(() => {
    if (!job?.id) return;
    setApplyError('');
    if (!user || user.role !== 'jobseeker') {
      setApplied(false);
      setCheckingStatus(false);
      return;
    }
    let cancelled = false;
    setCheckingStatus(true);
    api
      .get(`/applications/${job.id}/me`, { timeout: 4000 })
      .then((res) => {
        if (!cancelled) setApplied(!!res.data?.applied);
      })
      .catch(() => {
        if (!cancelled) setApplied(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
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
            <button onClick={handleBack} className="btn btn-primary">Back to jobs</button>
          </div>
        </div>
      </div>
    );
  }

  const handleApply = async () => {
    if (applied || submitting || checkingStatus) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isJobseeker) return;

    setApplyError('');
    setSubmitting(true);
    try {
      await api.post('/applications', { jobId: job.id }, { timeout: 8000 });
      setApplied(true);
    } catch (err) {
      if (err.status === 409) {
        // Already applied server-side (e.g. an earlier tab or a race).
        setApplied(true);
      } else {
        setApplyError(err?.message || 'Unable to submit your application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  let buttonLabel = 'Apply now';
  if (applied) buttonLabel = '✓ Applied';
  else if (submitting) buttonLabel = 'Applying…';
  else if (!user) buttonLabel = 'Sign in to apply';
  else if (!isJobseeker) buttonLabel = "Recruiters can't apply";

  const buttonDisabled = applied || submitting || checkingStatus || (!!user && !isJobseeker);

  return (
    <div className="job-detail-page">
      <div className="container">
        <button onClick={handleBack} className="job-detail-back">← Back to all jobs</button>

        <div className="job-detail-layout">
          <div className="job-detail-main">
            <header className="card job-detail-hero">
              <div className="job-detail-company">
                <div className="job-detail-avatar" aria-hidden="true">
                  {job.company.charAt(0)}
                </div>
                <div>
                  <h1 className="job-detail-title">{job.title}</h1>
                  <p className="job-detail-company-name">
                    {job.company} · {job.location}
                  </p>
                </div>
              </div>

              <div className="job-detail-tags">
                <span className={`badge badge-${job.workType === 'Remote' ? 'success' : job.workType === 'Hybrid' ? 'primary' : 'neutral'}`}>
                  {job.workType}
                </span>
                <span className="badge badge-neutral">{job.employmentType}</span>
                <span className="badge badge-neutral">{job.experienceLevel}</span>
              </div>
            </header>

            <section className="card job-detail-section">
              <h2 className="job-detail-section-title">About the role</h2>
              <p className="job-detail-description">{job.description}</p>
            </section>

            <section className="card job-detail-section">
              <h2 className="job-detail-section-title">Skills</h2>
              <div className="job-detail-skills">
                {job.skills.map((skill) => (
                  <span key={skill} className="skill-tag">{skill}</span>
                ))}
              </div>
            </section>
          </div>

          <aside className="job-detail-side">
            <div className="card job-detail-summary">
              <h2 className="job-detail-section-title">Job summary</h2>
              <dl className="job-detail-list">
                <div><dt>Salary</dt><dd>{formatSalary(job.salary)}</dd></div>
                <div><dt>Location</dt><dd>{job.location}</dd></div>
                <div><dt>Work type</dt><dd>{job.workType}</dd></div>
                <div><dt>Employment</dt><dd>{job.employmentType}</dd></div>
                <div><dt>Experience</dt><dd>{job.experienceLevel}</dd></div>
                <div><dt>Category</dt><dd>{job.category}</dd></div>
              </dl>
              <button
                className={`btn btn-primary btn-lg job-detail-apply ${applied ? 'applied' : ''}`}
                onClick={handleApply}
                disabled={buttonDisabled}
                aria-busy={submitting}
              >
                {buttonLabel}
              </button>

              {applied && (
                <p className="job-detail-applied-note">
                  Your application has been submitted. Good luck!
                </p>
              )}

              {applyError && (
                <p className="job-detail-apply-error" role="alert">
                  {applyError}
                </p>
              )}

              {!!user && !isJobseeker && !applied && (
                <p className="job-detail-apply-hint">
                  You're signed in as a recruiter. Switch to a jobseeker account to apply.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

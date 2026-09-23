import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiDelete } from '../utils/api';
import ProfileTabs from '../components/ProfileTabs';
import { formatSalary } from '../utils/salary';
import './SavedJobsPage.css';

const isWorkModeLocationOnly = (job) =>
  job.workType === 'Remote' && String(job.location || '').trim().toLowerCase() === 'remote';

export default function SavedJobsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [savedJobs, setSavedJobs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const loadSavedJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/saved-jobs');
      setSavedJobs(res.data?.savedJobs || []);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError(err?.message || 'Unable to load your saved jobs.');
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (user && user.role === 'jobseeker') {
      loadSavedJobs();
    }
  }, [user, loadSavedJobs]);

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

  if (authLoading || loading) {
    return (
      <div className="saved-jobs-page">
        <div className="container">
          <div className="saved-jobs-loading" aria-busy="true">Loading saved jobs…</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="saved-jobs-page">
      <div className="container">
        <ProfileTabs role={user.role} />

        <div className="card profile-form">
          <div className="profile-header">
            <div className="profile-header-text">
              <h1 className="profile-title">Saved jobs</h1>
              <p className="profile-subtitle">Jobs you've saved for later. Apply or remove them anytime.</p>
            </div>
          </div>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          {!error && savedJobs && savedJobs.length === 0 && (
            <div className="saved-jobs-empty">
              <div className="saved-jobs-empty-icon" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="saved-jobs-empty-title">No saved jobs yet</h3>
              <p className="saved-jobs-empty-desc">
                Hit the bookmark on any job you find interesting and it will be saved here for easy access later.
              </p>
              <Link to="/" className="btn btn-primary btn-lg">Find jobs</Link>
            </div>
          )}

          {savedJobs && savedJobs.length > 0 && (
            <div className="saved-jobs-list">
              {savedJobs.map((job) => (
                <div className="saved-jobs-card" key={job.id}>
                  <div className="saved-jobs-card-main">
                    <div className="saved-jobs-card-avatar" aria-hidden="true">
                      {(job.company || 'C').charAt(0)}
                    </div>
                    <div className="saved-jobs-card-info">
                      <Link to={`/jobs/${job.id}`} state={{ from: 'saved' }} className="saved-jobs-card-title">{job.title}</Link>
                      <span className="saved-jobs-card-company">{job.company}</span>
                      {job.location && !isWorkModeLocationOnly(job) && (
                        <span className="saved-jobs-card-location">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          {job.location}
                        </span>
                      )}
                    </div>
                    <div className="saved-jobs-card-aside">
                      <span className="saved-jobs-card-salary">{formatSalary(job.salary)}</span>
                    </div>
                  </div>

                  <div className="saved-jobs-card-meta">
                    {job.workType && <span className={`badge badge-${job.workType === 'Remote' ? 'success' : job.workType === 'Hybrid' ? 'primary' : 'neutral'}`}>{job.workType}</span>}
                    {job.employmentType && <span className="badge badge-neutral">{job.employmentType}</span>}
                    {job.experienceLevel && <span className="badge badge-neutral">{job.experienceLevel}</span>}
                  </div>

                  <div className="saved-jobs-card-actions">
                    <Link to={`/jobs/${job.id}`} state={{ from: 'saved' }} className="btn btn-sm btn-secondary">View job</Link>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost saved-jobs-remove-btn"
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
      </div>
    </div>
  );
}

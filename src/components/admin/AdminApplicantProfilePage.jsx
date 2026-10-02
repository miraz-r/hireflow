import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Avatar from '../Avatar';
import { avatarFallback, resolveMediaUrl } from '../../lib/media';
import { getAdminJobseeker } from '../../utils/adminApi';
import './AdminApplicantProfilePage.css';

const ARROW_LEFT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const formatDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Renders a date range for the education/experience sub-documents, which store
// a start date and either an end date or a `current` flag.
const formatRange = (entry) => {
  const start = entry.startDate ? new Date(entry.startDate).getUTCFullYear() : null;
  if (!start) return '—';
  if (entry.current) return `${start} — Present`;
  const end = entry.endDate ? new Date(entry.endDate).getUTCFullYear() : null;
  return end ? `${start} — ${end}` : `${start}`;
};

// The account's real current role. Shown verbatim rather than assuming the
// person is still a jobseeker, because an account can change role after having
// applied.
const ROLE_LABELS = {
  jobseeker: 'Jobseeker',
  recruiter: 'Recruiter',
  admin: 'Administrator',
};

const roleLabel = (role) => ROLE_LABELS[role] || role || 'Unknown';

/**
 * AdminApplicantProfilePage - /admin/jobseekers/:userId
 *
 * The real applicant profile, reached from the Admin Applications detail
 * panel's "View Profile".
 *
 * This is its own route rather than a redirect to /profile because /profile is
 * scoped to the signed-in user: GET /api/profile returns only the caller's own
 * profile, so an admin following that link would be shown their own account
 * instead of the applicant. The data comes from GET /api/admin/jobseekers/:userId,
 * which is admin-only and only ever returns jobseeker profiles.
 *
 * Every field is the stored value. A profile with no bio, skills, or history
 * renders an explicit empty state rather than placeholder text.
 */
export default function AdminApplicantProfilePage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminJobseeker(userId);
      setData(res.jobseeker);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const returnTo = `/admin/applications`;

  return (
    <div className="admin-page admin-applicant">
      <div className="admin-applicant-bar">
        <Link to={returnTo} className="admin-applicant-back">
          {ARROW_LEFT}
          Back to Applications
        </Link>
      </div>

      {loading ? (
        <div className="admin-applicant-state" aria-busy="true">
          <span className="admin-applicant-state-title">Loading profile...</span>
          <span className="admin-applicant-state-text">
            Fetching this applicant's details from the server.
          </span>
        </div>
      ) : error ? (
        <div className="admin-applicant-state">
          <span className="admin-applicant-state-title">Unable to load this profile</span>
          <span className="admin-applicant-state-text">
            {error?.message || 'Something went wrong while fetching the profile.'}
          </span>
          <button type="button" className="admin-applicant-btn" onClick={load}>
            Try again
          </button>
        </div>
      ) : !data.profileExists ? (
        <>
          {/* The account exists and has applied, but there is no jobseeker
              profile to show — either they never created one, or they switched
              their account role and toggleRole unset those fields. Stated
              plainly rather than shown as a failed load, and the account's real
              current role is named so it is never implied to be a jobseeker. */}
          <header className="admin-applicant-header">
            <Avatar
              src={data.avatarUrl ? resolveMediaUrl(data.avatarUrl) : null}
              fallbackSrc={avatarFallback(data.fullName, data.email)}
              imgClassName="admin-applicant-avatar"
              placeholderClassName="admin-applicant-avatar admin-applicant-avatar--initials"
              imgAlt=""
              iconSize={20}
            />
            <div className="admin-applicant-titles">
              <h2 className="admin-applicant-name">{data.fullName || data.email}</h2>
              <p className="admin-applicant-headline">
                {data.fullName ? 'No jobseeker profile on file' : 'No name on file'}
              </p>
              <p className="admin-applicant-meta">
                {[data.location, data.joinedAt ? `Joined ${formatDate(data.joinedAt)}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="admin-applicant-counts">
              <div className="admin-applicant-count">
                <span className="admin-applicant-count-value">{data.applications}</span>
                <span className="admin-applicant-count-label">Applications</span>
              </div>
              <div className="admin-applicant-count">
                <span className="admin-applicant-count-value">{data.savedJobs}</span>
                <span className="admin-applicant-count-label">Saved jobs</span>
              </div>
            </div>
          </header>

          {!data.isActiveJobseeker && (
            <p className="admin-applicant-role-note">
              This account is currently in the <strong>{roleLabel(data.activeWorkspace)}</strong>{' '}
              workspace. It holds the applications below from when it was a jobseeker, and that
              side of its profile is kept separately — there simply is no jobseeker profile on
              file for it.
            </p>
          )}

          <section className="admin-applicant-section">
            <h3 className="admin-applicant-sub">Contact</h3>
            <dl className="admin-applicant-list">
              <div className="admin-applicant-row">
                <dt>Email</dt>
                <dd>{data.email || '—'}</dd>
              </div>
              <div className="admin-applicant-row">
                <dt>Phone</dt>
                <dd>{data.phone || '—'}</dd>
              </div>
              <div className="admin-applicant-row">
                <dt>Account role</dt>
                <dd>{roleLabel(data.activeWorkspace)}</dd>
              </div>
            </dl>
          </section>
        </>
      ) : (
        <>
          <header className="admin-applicant-header">
            <Avatar
              src={data.avatarUrl ? resolveMediaUrl(data.avatarUrl) : null}
              fallbackSrc={avatarFallback(data.fullName, data.email)}
              imgClassName="admin-applicant-avatar"
              placeholderClassName="admin-applicant-avatar admin-applicant-avatar--initials"
              imgAlt=""
              iconSize={20}
            />
            <div className="admin-applicant-titles">
              <h2 className="admin-applicant-name">{data.fullName}</h2>
              {data.headline && <p className="admin-applicant-headline">{data.headline}</p>}
              <p className="admin-applicant-meta">
                {data.location || 'No location on file'}
                {data.location && data.joinedAt ? ' · ' : ''}
                {data.joinedAt ? `Joined ${formatDate(data.joinedAt)}` : ''}
              </p>
            </div>
            <div className="admin-applicant-counts">
              <div className="admin-applicant-count">
                <span className="admin-applicant-count-value">{data.applications}</span>
                <span className="admin-applicant-count-label">Applications</span>
              </div>
              <div className="admin-applicant-count">
                <span className="admin-applicant-count-value">{data.savedJobs}</span>
                <span className="admin-applicant-count-label">Saved jobs</span>
              </div>
            </div>
          </header>

          <section className="admin-applicant-section">
            <h3 className="admin-applicant-sub">Contact</h3>
            <dl className="admin-applicant-list">
              <div className="admin-applicant-row">
                <dt>Email</dt>
                <dd>{data.email || '—'}</dd>
              </div>
              <div className="admin-applicant-row">
                <dt>Phone</dt>
                <dd>{data.phone || '—'}</dd>
              </div>
              <div className="admin-applicant-row">
                <dt>Location</dt>
                <dd>{data.location || '—'}</dd>
              </div>
              <div className="admin-applicant-row">
                <dt>Account role</dt>
                <dd>{roleLabel(data.activeWorkspace)}</dd>
              </div>
            </dl>
          </section>

          {data.bio && (
            <section className="admin-applicant-section">
              <h3 className="admin-applicant-sub">About</h3>
              <p className="admin-applicant-bio">{data.bio}</p>
            </section>
          )}

          <section className="admin-applicant-section">
            <h3 className="admin-applicant-sub">Skills</h3>
            {data.skills.length ? (
              <div className="admin-applicant-skills">
                {data.skills.map((skill) => (
                  <span key={skill} className="admin-applicant-skill">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="admin-applicant-empty">No skills listed on this profile.</p>
            )}
          </section>

          <section className="admin-applicant-section">
            <h3 className="admin-applicant-sub">Experience</h3>
            {data.experience.length ? (
              <ul className="admin-applicant-entries">
                {data.experience.map((entry, index) => (
                  <li key={entry._id || index} className="admin-applicant-entry">
                    <span className="admin-applicant-entry-title">{entry.title}</span>
                    <span className="admin-applicant-entry-org">{entry.company}</span>
                    <span className="admin-applicant-entry-meta">
                      {[formatRange(entry), entry.location].filter(Boolean).join(' · ')}
                    </span>
                    {entry.description && (
                      <span className="admin-applicant-entry-body">{entry.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-applicant-empty">No work experience listed.</p>
            )}
          </section>

          <section className="admin-applicant-section">
            <h3 className="admin-applicant-sub">Education</h3>
            {data.education.length ? (
              <ul className="admin-applicant-entries">
                {data.education.map((entry, index) => (
                  <li key={entry._id || index} className="admin-applicant-entry">
                    <span className="admin-applicant-entry-title">
                      {entry.degree || entry.school}
                    </span>
                    <span className="admin-applicant-entry-org">{entry.school}</span>
                    <span className="admin-applicant-entry-meta">
                      {[formatRange(entry), entry.field].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-applicant-empty">No education listed.</p>
            )}
          </section>

          {data.links.length > 0 && (
            <section className="admin-applicant-section">
              <h3 className="admin-applicant-sub">Links</h3>
              <ul className="admin-applicant-entries">
                {data.links.map((link, index) => (
                  <li key={link._id || index} className="admin-applicant-entry">
                    <a
                      className="admin-applicant-entry-title admin-applicant-link"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                    <span className="admin-applicant-entry-org">{link.url}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

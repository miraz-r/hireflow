import './JobCard.css';

export default function JobCard({ job, isSaved, onSave }) {
  const formatSalary = (salary) => {
    if (salary.period === 'hourly') {
      return `$${salary.min}–$${salary.max}/hr`;
    }
    const formatNum = (n) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
    return `${formatNum(salary.min)} – ${formatNum(salary.max)}`;
  };

  const getWorkTypeBadge = (type) => {
    const variants = { Remote: 'success', Hybrid: 'primary', 'On-site': 'neutral' };
    return variants[type] || 'neutral';
  };

  return (
    <article className="job-card">
      <div className="job-header">
        <div className="job-company">
          <div className="company-avatar" aria-hidden="true">
            {job.company.charAt(0)}
          </div>
          <div className="company-info">
            <h3 className="company-name">{job.company}</h3>
            <p className="job-posted">{job.postedAt}</p>
          </div>
        </div>
        <button 
          className={`save-btn ${isSaved ? 'saved' : ''}`}
          onClick={onSave}
          aria-label={isSaved ? 'Remove from saved' : 'Save job'}
          aria-pressed={isSaved}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      <div className="job-body">
        <h4 className="job-title">{job.title}</h4>
        <p className="job-description">{job.description}</p>
      </div>

      <div className="job-meta">
        <div className="meta-row">
          <span className="meta-item location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {job.location}
          </span>
          <span className={`badge badge-${getWorkTypeBadge(job.workType)}`}>{job.workType}</span>
        </div>
        <div className="meta-row">
          <span className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            {job.employmentType}
          </span>
          <span className="meta-item salary">{formatSalary(job.salary)}</span>
        </div>
      </div>

      <div className="job-footer">
        <div className="skills-list">
          {job.skills.slice(0, 3).map(skill => (
            <span key={skill} className="skill-tag">{skill}</span>
          ))}
          {job.skills.length > 3 && (
            <span className="skill-more">+{job.skills.length - 3}</span>
          )}
        </div>
        <span className="experience-badge">{job.experienceLevel}</span>
      </div>
    </article>
  );
}
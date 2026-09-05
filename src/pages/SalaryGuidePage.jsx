import { Link } from 'react-router-dom';
import './SalaryGuidePage.css';

const SALARY_DATA = [
  { role: 'Frontend Engineer', entry: '$95k – $120k', mid: '$130k – $170k', senior: '$170k – $220k', entryMin: 95, entryMax: 120, midMin: 130, midMax: 170, senMin: 170, senMax: 220 },
  { role: 'Backend Engineer', entry: '$100k – $125k', mid: '$140k – $180k', senior: '$180k – $230k', entryMin: 100, entryMax: 125, midMin: 140, midMax: 180, senMin: 180, senMax: 230 },
  { role: 'Product Manager', entry: '$90k – $115k', mid: '$130k – $165k', senior: '$165k – $210k', entryMin: 90, entryMax: 115, midMin: 130, midMax: 165, senMin: 165, senMax: 210 },
  { role: 'UX Designer', entry: '$80k – $105k', mid: '$115k – $150k', senior: '$150k – $195k', entryMin: 80, entryMax: 105, midMin: 115, midMax: 150, senMin: 150, senMax: 195 },
  { role: 'Data Scientist', entry: '$100k – $130k', mid: '$140k – $180k', senior: '$180k – $240k', entryMin: 100, entryMax: 130, midMin: 140, midMax: 180, senMin: 180, senMax: 240 },
  { role: 'DevOps Engineer', entry: '$95k – $120k', mid: '$135k – $175k', senior: '$175k – $225k', entryMin: 95, entryMax: 120, midMin: 135, midMax: 175, senMin: 175, senMax: 225 },
];

const MAX_SENIOR = 240;

const STEPS = [
  { num: '01', title: 'Research compensation philosophy', body: 'Every company structures pay differently. Understanding how a company approaches compensation, before your offer conversation, gives you a meaningful advantage.' },
  { num: '02', title: 'Consider the full package', body: 'Base salary is only one component. Bonuses, equity, benefits, retirement contributions, and flexibility all contribute to your total compensation.' },
  { num: '03', title: 'Quantify your impact', body: 'Build a clear case for your value. Document specific outcomes, metrics, and results from your previous roles. Concrete numbers make your argument stronger.' },
  { num: '04', title: 'Prepare your negotiation', body: 'Practice the conversation beforehand. Know your target range, your walk-away point, and how to articulate what you bring to the role.' },
  { num: '05', title: 'Evaluate the complete offer', body: 'Take time to review the full written offer. Compare it against these benchmarks and your own priorities before responding.' },
];

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
  </svg>
);

function SalaryRangeBar({ min, max, maxVal }) {
  const left = (min / maxVal) * 100;
  const width = ((max - min) / maxVal) * 100;
  return (
    <div className="sg-range-track" aria-hidden="true">
      <div className="sg-range-fill" style={{ left: `${left}%`, width: `${width}%` }} />
    </div>
  );
}

export default function SalaryGuidePage() {
  return (
    <div className="sg-page">
      {/* Hero */}
      <section className="sg-hero">
        <div className="container">
          <div className="sg-hero-layout">
            <div className="sg-hero-text">
              <span className="sg-hero-eyebrow">Compensation</span>
              <h1 className="sg-hero-title">Salary Guide</h1>
              <p className="sg-hero-desc">
                Transparent salary benchmarks across roles, experience levels, and locations to help you negotiate with confidence.
              </p>
            </div>
            <div className="sg-hero-visual" aria-hidden="true">
              <div className="sg-hero-stat-card">
                <span className="sg-hero-stat-label">Avg. Senior Range</span>
                <span className="sg-hero-stat-value">$170k – $240k</span>
                <div className="sg-hero-stat-bar">
                  <div className="sg-hero-stat-bar-fill" />
                </div>
              </div>
              <div className="sg-hero-stat-card">
                <span className="sg-hero-stat-label">Avg. Mid-Level Range</span>
                <span className="sg-hero-stat-value">$130k – $180k</span>
                <div className="sg-hero-stat-bar">
                  <div className="sg-hero-stat-bar-fill sg-hero-stat-bar-fill--mid" />
                </div>
              </div>
              <div className="sg-hero-stat-card">
                <span className="sg-hero-stat-label">Avg. Entry Range</span>
                <span className="sg-hero-stat-value">$90k – $130k</span>
                <div className="sg-hero-stat-bar">
                  <div className="sg-hero-stat-bar-fill sg-hero-stat-bar-fill--entry" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Salary Table */}
      <section className="sg-section sg-salary-section" aria-label="Salary data">
        <div className="container">
          <div className="sg-section-header">
            <span className="sg-section-label">Salary Data</span>
            <h2 className="sg-section-heading">Popular role salaries</h2>
            <p className="sg-section-sub">
              Ranges shown include base salary, bonuses, and equity where applicable.
            </p>
          </div>

          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead>
                <tr>
                  <th className="sg-th-role">Role</th>
                  <th className="sg-th-level">
                    <span className="sg-level-label">Entry-level</span>
                  </th>
                  <th className="sg-th-level">
                    <span className="sg-level-label">Mid-level</span>
                  </th>
                  <th className="sg-th-level">
                    <span className="sg-level-label">Senior</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {SALARY_DATA.map((row) => (
                  <tr key={row.role}>
                    <td className="sg-td-role">{row.role}</td>
                    <td className="sg-td-salary">
                      <span className="sg-salary-value">{row.entry}</span>
                      <SalaryRangeBar min={row.entryMin} max={row.entryMax} maxVal={MAX_SENIOR} />
                    </td>
                    <td className="sg-td-salary">
                      <span className="sg-salary-value">{row.mid}</span>
                      <SalaryRangeBar min={row.midMin} max={row.midMax} maxVal={MAX_SENIOR} />
                    </td>
                    <td className="sg-td-salary">
                      <span className="sg-salary-value">{row.senior}</span>
                      <SalaryRangeBar min={row.senMin} max={row.senMax} maxVal={MAX_SENIOR} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sg-table-legend">
            <span className="sg-legend-item">
              <span className="sg-legend-dot sg-legend-dot--entry" /> Entry-level
            </span>
            <span className="sg-legend-item">
              <span className="sg-legend-dot sg-legend-dot--mid" /> Mid-level
            </span>
            <span className="sg-legend-item">
              <span className="sg-legend-dot sg-legend-dot--senior" /> Senior
            </span>
          </div>
        </div>
      </section>

      {/* Data Context */}
      <section className="sg-section sg-context-section">
        <div className="container">
          <div className="sg-context-layout">
            <div className="sg-context-text">
              <span className="sg-section-label">Understanding the data</span>
              <h2 className="sg-section-heading">What these numbers represent</h2>
            </div>
            <div className="sg-context-items">
              <div className="sg-context-item">
                <div className="sg-context-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                </div>
                <div>
                  <h3 className="sg-context-title">Base salary</h3>
                  <p className="sg-context-desc">Fixed annual compensation before bonuses or equity.</p>
                </div>
              </div>
              <div className="sg-context-item">
                <div className="sg-context-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                </div>
                <div>
                  <h3 className="sg-context-title">Bonuses</h3>
                  <p className="sg-context-desc">Performance-based and annual bonus potential.</p>
                </div>
              </div>
              <div className="sg-context-item">
                <div className="sg-context-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                  <h3 className="sg-context-title">Equity</h3>
                  <p className="sg-context-desc">Stock options or RSUs where applicable.</p>
                </div>
              </div>
              <div className="sg-context-item">
                <div className="sg-context-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <div>
                  <h3 className="sg-context-title">Benefits and flexibility</h3>
                  <p className="sg-context-desc">Health, retirement, PTO, and remote-work options.</p>
                </div>
              </div>
            </div>
          </div>
          <p className="sg-context-note">
            These figures are benchmarks based on role, experience level, and market data.
            Actual offers vary by company size, location, and individual qualifications.
            Use these as a starting point for your evaluation, not as a guarantee.
          </p>
        </div>
      </section>

      {/* How to Use */}
      <section className="sg-section sg-steps-section">
        <div className="container">
          <div className="sg-section-header">
            <span className="sg-section-label">Negotiation guidance</span>
            <h2 className="sg-section-heading">How to use this data</h2>
          </div>
          <div className="sg-steps">
            {STEPS.map((step) => (
              <div key={step.num} className="sg-step">
                <span className="sg-step-num" aria-hidden="true">{step.num}</span>
                <div className="sg-step-content">
                  <h3 className="sg-step-title">{step.title}</h3>
                  <p className="sg-step-body">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="sg-section sg-cta-section">
        <div className="container">
          <div className="sg-cta-card">
            <div className="sg-cta-content">
              <h2 className="sg-cta-title">Find roles matching your skills</h2>
              <p className="sg-cta-desc">
                Browse current openings with transparent salary ranges and find the right fit for your experience.
              </p>
            </div>
            <Link to="/" className="sg-cta-btn">
              Browse jobs <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

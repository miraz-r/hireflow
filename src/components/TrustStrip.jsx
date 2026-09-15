import './TrustStrip.css';

export default function TrustStrip() {
  const stats = [
    { value: '12,400+', label: 'Active opportunities' },
    { value: '4,800', label: 'Hiring companies' },
    { value: 'Remote-first', label: 'Flexible work options' }
  ];

  const renderStats = (ariaHidden) => (
    <div className="trust-ticker-group" aria-hidden={ariaHidden || undefined}>
      {stats.map((stat, idx) => (
        <div key={idx} className="trust-item">
          <div className="trust-value">{stat.value}</div>
          <div className="trust-label">{stat.label}</div>
        </div>
      ))}
    </div>
  );

  return (
    <section className="trust-strip">
      <div className="container">
        <div className="trust-ticker">
          <div className="trust-ticker-track">
            {renderStats(false)}
            {renderStats(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
import './AdminKpiCard.css';

export default function AdminKpiCard({ label, value, delta, hint, context, tone = 'default' }) {
  const deltaClass = delta == null ? 'admin-kpi-neutral' : delta >= 0 ? 'admin-kpi-up' : 'admin-kpi-down';
  const arrow = delta == null ? '' : delta >= 0 ? '\u25B2' : '\u25BC';
  const deltaText = delta == null ? '' : arrow + ' ' + Math.abs(delta) + '%';
  const toneClass = 'admin-kpi-card admin-kpi-tone-' + tone;
  return (
    <div className={toneClass}>
      <span className="admin-kpi-label">{label}</span>
      <strong className="admin-kpi-value">{value != null ? value : '\u2014'}</strong>
      {(delta != null || hint) ? (
        <span className={deltaClass + ' admin-kpi-delta'}>
          {deltaText}
          {hint ? <span className="admin-kpi-hint"> &middot; {hint}</span> : null}
        </span>
      ) : context ? (
        <span className="admin-kpi-context">{context}</span>
      ) : null}
    </div>
  );
}

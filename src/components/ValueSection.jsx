import './ValueSection.css';

const values = [
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    title: 'Better discovery',
    description: 'Our smart matching understands context, not just keywords. Find roles you might have missed on traditional job boards.'
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    title: 'Stay organized',
    description: 'Track all your applications in one place. Know exactly where each opportunity stands without the spreadsheet chaos.'
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    title: 'Build your profile',
    description: 'Create a compelling professional presence that highlights what makes you valuable, not just what you\'ve done.'
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
    title: 'Save for later',
    description: 'Bookmark interesting opportunities without the pressure. Revisit them when the timing feels right.'
  }
];

export default function ValueSection() {
  return (
    <section className="value-section" id="value">
      <div className="container">
        <div className="value-header">
          <span className="section-eyebrow section-eyebrow--on-dark">Why HireFlow</span>
          <h2 className="value-title">Why professionals choose HireFlow</h2>
          <p className="value-subtitle">Tools designed around how you actually search for work</p>
        </div>
        <div className="value-grid">
          {values.map((item, idx) => (
            <article key={idx} className="value-card">
              <div className="value-icon">{item.icon}</div>
              <h3 className="value-card-title">{item.title}</h3>
              <p className="value-card-description">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
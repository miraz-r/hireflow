import './CompanySection.css';

export default function CompanySection({ companies }) {
  return (
    <section className="companies-section" id="companies">
      <div className="container">
        <div className="section-header section-header-center">
          <h2 className="section-title">Trusted by ambitious teams</h2>
          <p className="section-subtitle">From early-stage startups to established industry leaders</p>
        </div>
        <div className="companies-grid">
          {companies.map(company => (
            <article key={company.id} className="company-card">
              <div className="company-logo" aria-hidden="true">
                {company.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div className="company-details">
                <h3 className="company-name">{company.name}</h3>
                <p className="company-industry">{company.industry}</p>
                <span className="company-hiring">
                  <span className="hiring-dot"></span>
                  {company.hiringCount} open roles
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
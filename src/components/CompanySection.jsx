import './CompanySection.css';
import CompanyLogo from './CompanyLogo';

export default function CompanySection({ companies }) {
  return (
    <section className="companies-section" id="companies">
      <div className="container">
        <div className="section-header section-header-center">
          <h2 className="section-title">Companies hiring on HireFlow</h2>
          <p className="section-subtitle">From early-stage startups to established industry leaders</p>
        </div>
        <div className="companies-grid">
          {companies.map(company => (
            <article key={company.id} className="company-card">
              <CompanyLogo
                name={company.name}
                domain={company.domain}
                imgClassName="company-logo"
                initialsClassName="company-logo"
              />
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
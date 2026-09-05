import { useParams, Link } from 'react-router-dom';
import { getResourceBySlug, getRelatedResources } from '../data/resources';
import './ResourceDetailPage.css';

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function ResourceDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const resource = getResourceBySlug(slug);
  const related = getRelatedResources(slug, 3);

  if (!resource) {
    return (
      <div className="resource-detail-page">
        <div className="container">
          <div className="resource-detail-not-found">
            <h1>Resource not found</h1>
            <p>The resource you are looking for does not exist or has been moved.</p>
            <Link to="/resources" className="resource-detail-back">
              <ArrowIcon /> Back to Resources
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-detail-page">
      {/* Back nav */}
      <div className="resource-detail-topbar">
        <div className="container">
          <Link to="/resources" className="resource-detail-back">
            <ArrowIcon /> Back to Resources
          </Link>
        </div>
      </div>

      {/* Hero */}
      <header className="resource-detail-hero">
        <div className="container">
          <span className="resource-detail-category">{resource.category}</span>
          <h1 className="resource-detail-title">{resource.title}</h1>
        </div>
      </header>

      {/* Hero image */}
      <div className="resource-detail-image-wrap">
        <div className="container">
          <div className="resource-detail-image-container">
            <img
              src={resource.image}
              alt={resource.title}
              className="resource-detail-image"
              loading="eager"
            />
          </div>
        </div>
      </div>

      {/* Article body */}
      <article className="resource-detail-body">
        <div className="container">
          <div className="resource-detail-content">
            <p className="resource-detail-intro">{resource.content.intro}</p>

            {resource.content.sections.map((section, i) => (
              <section key={i} className="resource-detail-section">
                <h2 className="resource-detail-section-heading">{section.heading}</h2>
                <p className="resource-detail-section-body">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </article>

      {/* Related resources */}
      {related.length > 0 && (
        <section className="resource-detail-related" aria-label="Related resources">
          <div className="container">
            <h2 className="resource-detail-related-heading">Explore more resources</h2>
            <div className="resource-detail-related-grid">
              {related.map((rel) => (
                <Link
                  key={rel.slug}
                  to={`/resources/${rel.slug}`}
                  className="resource-detail-related-card"
                >
                  <div className="resource-detail-related-image-wrap">
                    <img
                      src={rel.image}
                      alt={rel.title}
                      className="resource-detail-related-image"
                      loading="lazy"
                    />
                  </div>
                  <div className="resource-detail-related-body">
                    <span className="resource-detail-related-cat">{rel.category}</span>
                    <h3 className="resource-detail-related-title">{rel.title}</h3>
                    <span className="resource-detail-related-link">
                      Read more <ChevronIcon />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="resource-detail-cta">
        <div className="container">
          <div className="resource-detail-cta-inner">
            <h2 className="resource-detail-cta-title">Ready to find your next role?</h2>
            <p className="resource-detail-cta-desc">
              Browse thousands of opportunities on HireFlow and take the next step in your career.
            </p>
            <Link to="/jobs" className="resource-detail-cta-btn">
              Browse Jobs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

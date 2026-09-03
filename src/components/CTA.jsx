import { useNavigate } from 'react-router-dom';
import './CTA.css';

export default function CTA() {
  const navigate = useNavigate();

  const handleBrowse = () => {
    const el = document.getElementById('jobs');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    else navigate('/');
  };

  return (
    <section className="cta-section" id="cta">
      <div className="container">
        <div className="cta-card">
          <div className="cta-content">
            <h2 className="cta-title">Ready to find your next opportunity?</h2>
            <p className="cta-description">
              Join thousands of professionals who have discovered better career paths through HireFlow.
            </p>
            <div className="cta-actions">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>Create free account</button>
              <button className="btn btn-secondary btn-lg" onClick={handleBrowse}>Browse jobs</button>
            </div>
          </div>
          <div className="cta-decoration" aria-hidden="true">
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="80" stroke="rgba(79, 70, 229, 0.1)" strokeWidth="2" fill="none"/>
              <circle cx="100" cy="100" r="60" stroke="rgba(79, 70, 229, 0.08)" strokeWidth="2" fill="none"/>
              <circle cx="100" cy="100" r="40" stroke="rgba(79, 70, 229, 0.06)" strokeWidth="2" fill="none"/>
              <circle cx="100" cy="100" r="20" fill="rgba(79, 70, 229, 0.05)"/>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
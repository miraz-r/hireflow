import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Footer.css';

function FooterLink({ to, children }) {
  const navigate = useNavigate();

  // Links to homepage sections (e.g. #jobs, #companies) should scroll there;
  // if we're not on the homepage, navigate there first, then scroll.
  const handleAnchor = (e, hash) => {
    const id = hash.replace('#', '');
    if (window.location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    e.preventDefault();
    navigate('/', { state: { scrollTo: id } });
  };

  if (to.startsWith('#')) {
    return (
      <a href={to} onClick={(e) => handleAnchor(e, to)}>{children}</a>
    );
  }
  return <Link to={to}>{children}</Link>;
}

function FooterSocial({ label, to }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="footer-social-btn"
      aria-label={label}
      onClick={() => navigate(to)}
    >
      {label === 'Twitter' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
      )}
      {label === 'LinkedIn' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
      )}
      {label === 'GitHub' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
      )}
    </button>
  );
}

const publicLinks = {
  product: [
    { label: 'Find Jobs', to: '#jobs' },
    { label: 'Companies', to: '#companies' },
    { label: 'Salary Guide', to: '/salary-guide' },
    { label: 'Resources', to: '/resources' }
  ],
  company: [
    { label: 'About Us', to: '/about' },
    { label: 'Blog', to: '/blog' },
    { label: 'Careers', to: '/careers' },
    { label: 'Press', to: '/press' }
  ],
  legal: [
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms of Service', to: '/terms' },
    { label: 'Cookie Policy', to: '/cookie-policy' },
    { label: 'Accessibility', to: '/accessibility' }
  ]
};

const jobseekerLinks = {
  product: publicLinks.product,
  candidates: [
    { label: 'Profile', to: '/profile' },
    { label: 'Saved Jobs', to: '/saved-jobs' },
    { label: 'Applications', to: '/profile?tab=my-applications' },
    { label: 'Career Advice', to: '/career-advice' }
  ],
  company: publicLinks.company,
  legal: publicLinks.legal
};

const recruiterLinks = {
  product: publicLinks.product,
  employers: [
    { label: 'Profile', to: '/profile' },
    { label: 'Post a Job', to: '/profile?tab=post' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Talent Search', to: '/talent-search' },
    { label: 'Solutions', to: '/solutions' }
  ],
  company: publicLinks.company,
  legal: publicLinks.legal
};

const guestLinks = {
  product: publicLinks.product,
  company: publicLinks.company,
  legal: publicLinks.legal
};

const COLUMN_HEADINGS = {
  product: 'Product',
  candidates: 'Candidates',
  employers: 'Employers',
  company: 'Company',
  legal: 'Legal'
};

export default function Footer() {
  const { user } = useAuth();

  const links = user?.role === 'recruiter'
    ? recruiterLinks
    : user?.role === 'jobseeker'
      ? jobseekerLinks
      : guestLinks;

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="7" fill="#4f46e5"/>
                <path d="M9 11h14v2.5H9zm0 5h10v2.5H9zm0 5h12v2.5H9z" fill="white"/>
              </svg>
              <span>HireFlow</span>
            </Link>
            <p className="footer-tagline">Find work worth working for.</p>
          </div>

          <div className={`footer-links footer-links--count-${Object.keys(links).length}`}>
            {Object.entries(links).map(([key, linkList]) => (
              <div className="footer-column" key={key}>
                <h4 className="footer-heading">{COLUMN_HEADINGS[key]}</h4>
                <ul className="footer-list">
                  {linkList.map(link => (
                    <li key={link.label}><FooterLink to={link.to}>{link.label}</FooterLink></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer-bottom">
          <p className="copyright">{new Date().getFullYear()} HireFlow. All rights reserved.</p>
          <div className="footer-social">
            <FooterSocial label="Twitter" to="/solutions" />
            <FooterSocial label="LinkedIn" to="/solutions" />
            <FooterSocial label="GitHub" to="/solutions" />
          </div>
        </div>
      </div>
    </footer>
  );
}

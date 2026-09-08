import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Footer.css';

function FooterLink({ to, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Same-page anchor: /#jobs, #companies
  const handleSamePageAnchor = (e, hash) => {
    e.preventDefault();
    const id = hash.replace('#', '');
    if (location.pathname === '/') {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    // Not on homepage or element missing — navigate to homepage with anchor intent
    navigate('/', { state: { scrollTo: id } });
  };

  // Cross-page anchor: /about#team
  const handleCrossPageAnchor = (e, path, hash) => {
    e.preventDefault();
    const id = hash.replace('#', '');
    navigate(`${path}${hash}`, { state: { scrollTo: id } });
  };

  // Same-page root link: clicking /about while on /about
  const handleSamePageRoot = (e, path) => {
    e.preventDefault();
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  // Pure hash link: #jobs
  if (to.startsWith('#')) {
    return (
      <a href={to} onClick={(e) => handleSamePageAnchor(e, to)}>{children}</a>
    );
  }

  // Cross-page anchor: /about#team
  const hashIndex = to.indexOf('#');
  if (hashIndex !== -1) {
    const path = to.slice(0, hashIndex);
    const hash = to.slice(hashIndex);
    return (
      <Link
        to={to}
        onClick={(e) => {
          if (location.pathname === path) {
            // Same page, different hash — scroll to target
            e.preventDefault();
            const id = hash.replace('#', '');
            const el = document.getElementById(id);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          } else {
            // Cross-page — navigate with hash preserved
            handleCrossPageAnchor(e, path, hash);
          }
        }}
      >
        {children}
      </Link>
    );
  }

  // Root page link: /about, /blog
  return <Link to={to} onClick={(e) => {
    if (location.pathname === to) {
      handleSamePageRoot(e, to);
    }
  }}>{children}</Link>;
}

function FooterSocial({ label, url }) {
  return (
    <a
      href={url}
      className="footer-social-btn"
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label === 'X' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l16 16M20 4L4 20" /></svg>
      )}
      {label === 'LinkedIn' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
      )}
      {label === 'GitHub' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
      )}
    </a>
  );
}

const publicLinks = {
  product: [
    { label: 'Find Jobs', to: '#jobs' },
    { label: 'Companies', to: '#companies' },
    { label: 'Salary Guide', to: '/salary-guide' },
    { label: 'Resources', to: '/resources' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Career Advice', to: '/career-advice' }
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
    { label: 'Applications', to: '/profile?tab=my-applications' }
  ],
  company: publicLinks.company,
  legal: publicLinks.legal
};

const recruiterLinks = {
  product: publicLinks.product,
  employers: [
    { label: 'Profile', to: '/profile' },
    { label: 'Post a Job', to: '/profile?tab=post' },
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
            <FooterSocial label="X" url="https://x.com/_mirazr" />
            <FooterSocial label="LinkedIn" url="https://www.linkedin.com/in/miraz-r/" />
            <FooterSocial label="GitHub" url="https://github.com/miraz-r" />
          </div>
        </div>
      </div>
    </footer>
  );
}

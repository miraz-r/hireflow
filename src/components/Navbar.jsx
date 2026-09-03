import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { label: 'Find Jobs', href: '#jobs' },
    { label: 'Companies', href: '#companies' },
    { label: 'Resources', href: '#' }
  ];

  return (
    <header className="navbar">
      <div className="container navbar-container">
        <a href="/" className="navbar-brand" aria-label="HireFlow home">
          <svg className="brand-icon" width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill="#4f46e5"/>
            <path d="M9 11h14v2.5H9zm0 5h10v2.5H9zm0 5h12v2.5H9z" fill="white"/>
          </svg>
          <span className="brand-text">HireFlow</span>
        </a>

        <nav className="navbar-nav" aria-label="Primary navigation">
          {links.map(link => (
            <a key={link.label} href={link.href} className="nav-link">{link.label}</a>
          ))}
        </nav>

        <div className="navbar-actions">
          <a className="sign-in-link" href="#">Sign in</a>
          <a className="sign-up-link" href="#">Sign up</a>
        </div>

        <button
          className="mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <span className={`hamburger ${mobileOpen ? 'open' : ''}`} aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-menu" id="mobile-menu">
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {links.map(link => (
              <a key={link.label} href={link.href} className="mobile-link" onClick={() => setMobileOpen(false)}>{link.label}</a>
            ))}
            <div className="mobile-actions">
              <a className="btn btn-secondary btn-full" href="#">Sign in</a>
              <a className="btn btn-primary btn-full" href="#">Sign up</a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
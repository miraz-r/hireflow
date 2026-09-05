import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const LOGOUT_VISIBLE_MS = 750;
const AVATAR_BASE = 'http://localhost:5000';

export default function Navbar() {
  const { user, logout, toggleRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    if (user && !loggingOut) return;
    if (user && loggingOut) setLoggingOut(false);
  }, [user, loggingOut]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  const handleLogout = async (e) => {
    e.preventDefault();
    if (loggingOut) return;
    setMenuOpen(false);
    setLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, LOGOUT_VISIBLE_MS));
    logout();
    setMobileOpen(false);
    navigate('/login');
  };

  const handleSwitchRole = async () => {
    if (!user) return;
    const targetRole = user.role === 'jobseeker' ? 'recruiter' : 'jobseeker';
    setMenuOpen(false);
    try {
      await toggleRole(targetRole);
      window.location.reload();
    } catch {
      // role unchanged on failure
    }
  };

  const handleAccountClick = () => {
    setMenuOpen((prev) => !prev);
  };

  const handleProfileNavigate = () => {
    setMenuOpen(false);
  };

  const goToAnchor = (e, id) => {
    e.preventDefault();
    setMobileOpen(false);
    if (window.location.pathname === '/') {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate('/', { state: { scrollTo: id } });
  };

  const handleLogoClick = () => {
    setMobileOpen(false);
    if (window.location.pathname === '/') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  };

  const links = [
    { label: 'Find Jobs', href: '/#jobs', scrollTo: 'jobs' },
    { label: 'Companies', href: '/#companies', scrollTo: 'companies' },
    { label: 'Resources', href: '/resources' },
  ];

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage) {
    return (
      <header className="navbar navbar--auth">
        <div className="container navbar-container">
          <Link to="/" className="navbar-brand" aria-label="HireFlow home" onClick={handleLogoClick}>
            <svg className="brand-icon" width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="#4f46e5"/>
              <path d="M9 11h14v2.5H9zm0 5h10v2.5H9zm0 5h12v2.5H9z" fill="white"/>
            </svg>
            <span className="brand-text">HireFlow</span>
          </Link>
          <div className="navbar-actions">
            <Link to="/login" className="sign-in-link">Sign in</Link>
            <Link to="/register" className="sign-up-link">Sign up</Link>
          </div>
        </div>
      </header>
    );
  }

  const roleLabel = user?.role === 'recruiter' ? 'Recruiter' : 'Jobseeker';
  const switchLabel = user?.role === 'recruiter' ? 'Switch to Jobseeker' : 'Switch to Recruiter';
  const avatarSrc = user?.avatarUrl ? `${AVATAR_BASE}${user.avatarUrl}` : null;
  const userInitial = ((user?.fullName || user?.email || 'U').charAt(0)).toUpperCase();

  return (
    <header className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand" aria-label="HireFlow home" onClick={handleLogoClick}>
          <svg className="brand-icon" width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill="#4f46e5"/>
            <path d="M9 11h14v2.5H9zm0 5h10v2.5H9zm0 5h12v2.5H9z" fill="white"/>
          </svg>
          <span className="brand-text">HireFlow</span>
        </Link>

        <nav className="navbar-nav" aria-label="Primary navigation">
          {links.map(link => (
            link.scrollTo ? (
              <a key={link.label} href={link.href} className="nav-link" onClick={(e) => goToAnchor(e, link.scrollTo)}>{link.label}</a>
            ) : (
              <Link key={link.label} to={link.href} className="nav-link" onClick={() => setMobileOpen(false)}>{link.label}</Link>
            )
          ))}
        </nav>

        <div className="navbar-actions">
          {user ? (
            <div className="account-wrapper" ref={accountRef}>
              <span className="account-role-label">{roleLabel}</span>
              <button
                type="button"
                className="account-trigger"
                onClick={handleAccountClick}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="Account menu"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="account-avatar-img" />
                ) : (
                  <span className="account-avatar-placeholder">{userInitial}</span>
                )}
              </button>

              {menuOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-menu-header">
                    <strong className="account-menu-name">{user.fullName || 'Your profile'}</strong>
                    <span className="account-menu-email">{user.email}</span>
                  </div>
                  <div className="account-menu-divider" />
                  <Link
                    to="/profile"
                    className="account-menu-item"
                    role="menuitem"
                    onClick={handleProfileNavigate}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile
                  </Link>
                  {user.role === 'jobseeker' && (
                    <>
                      <Link
                        to="/saved-jobs"
                        className="account-menu-item"
                        role="menuitem"
                        onClick={handleProfileNavigate}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        Saved Jobs
                      </Link>
                      <Link
                        to="/profile?tab=my-applications"
                        className="account-menu-item"
                        role="menuitem"
                        onClick={handleProfileNavigate}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                        Applications
                      </Link>
                    </>
                  )}
                  {user.role === 'recruiter' && (
                    <Link
                      to="/profile?tab=post"
                      className="account-menu-item"
                      role="menuitem"
                      onClick={handleProfileNavigate}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      Post a Job
                    </Link>
                  )}
                  <div className="account-menu-divider" />
                  <button
                    type="button"
                    className="account-menu-item"
                    role="menuitem"
                    onClick={handleSwitchRole}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 1l4 4-4 4" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    {switchLabel}
                  </button>
                  <div className="account-menu-divider" />
                  <button
                    type="button"
                    className="account-menu-item account-menu-item--danger"
                    role="menuitem"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    {loggingOut ? 'Logging out…' : 'Log out'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="sign-in-link">Sign in</Link>
              <Link to="/register" className="sign-up-link">Sign up</Link>
            </>
          )}
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
              link.scrollTo ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="mobile-link"
                  onClick={(e) => goToAnchor(e, link.scrollTo)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="mobile-link"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              )
            ))}
            <div className="mobile-actions">
              {user ? (
                <div className="mobile-user-info">
                  <div className="mobile-user-identity">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" className="mobile-user-avatar-img" />
                    ) : (
                      <span className="mobile-user-avatar-placeholder">{userInitial}</span>
                    )}
                    <div className="mobile-user-text">
                      <span className="mobile-user-name">{user.fullName || user.email}</span>
                      <span className="mobile-user-role">{roleLabel}</span>
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    className="btn btn-secondary btn-full"
                    onClick={() => setMobileOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    className="btn btn-secondary btn-full"
                    onClick={handleSwitchRole}
                    type="button"
                  >
                    {switchLabel}
                  </button>
                  <button
                    className="btn btn-primary btn-full"
                    onClick={handleLogout}
                    type="button"
                    disabled={loggingOut}
                  >
                    {loggingOut ? 'Logging out…' : 'Log out'}
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="btn btn-secondary btn-full"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary btn-full"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

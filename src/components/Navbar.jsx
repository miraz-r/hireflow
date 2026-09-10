import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
import { useTheme } from '../hooks/useTheme';

const LOGOUT_VISIBLE_MS = 750;
const AVATAR_BASE = 'http://localhost:5000';

export default function Navbar() {
  const { user, logout, toggleRole } = useAuth();
  const { theme, updateTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerActive, setDrawerActive] = useState(false);
  const accountRef = useRef(null);
  const drawerRef = useRef(null);
  const closeRef = useRef(null);
  const hamburgerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const openRafRef = useRef(null);
  const pendingAnchorRef = useRef(null);
  const restoreScrollRef = useRef(true);

  useEffect(() => {
    if (user && !loggingOut) return;
    if (user && loggingOut) setLoggingOut(false);
  }, [user, loggingOut]);

  // Close desktop menu on outside click
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

  // Close desktop menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  // Mobile drawer: body scroll lock + Escape key
  useEffect(() => {
    if (!drawerMounted) return;

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const handleEscape = (e) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      // Restore the pre-open scroll position, UNLESS a drawer route link
      // initiated navigation that changed the page — restoring the old offset
      // onto the destination page would sabotage its intended scroll position.
      if (restoreScrollRef.current) {
        window.scrollTo(0, scrollY);
      }
      document.removeEventListener('keydown', handleEscape);
    };
  }, [drawerMounted]);

  // Defer anchor navigation until the drawer has fully closed and the body
  // scroll-lock above is released. This guarantees ScrollToTop performs its
  // bounded-retry smooth scroll on an unlocked document, so the anchor scroll
  // actually takes effect and never fights the scroll-lock restore.
  useEffect(() => {
    if (drawerMounted || !pendingAnchorRef.current) return;
    const id = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    navigate('/', { state: { scrollTo: id } });
  }, [drawerMounted, navigate]);

  // Cleanup timers/RAF on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (openRafRef.current) cancelAnimationFrame(openRafRef.current);
    };
  }, []);

  const openMobile = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    pendingAnchorRef.current = null;
    restoreScrollRef.current = true;
    setMobileOpen(true);
    setDrawerMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDrawerActive(true);
        if (closeRef.current) closeRef.current.focus();
      });
    });
  }, []);

  const closeMobile = useCallback(() => {
    if (openRafRef.current) {
      cancelAnimationFrame(openRafRef.current);
      openRafRef.current = null;
    }
    setMobileOpen(false);
    setDrawerActive(false);
    if (!closeTimerRef.current) {
      closeTimerRef.current = setTimeout(() => {
        setDrawerMounted(false);
        closeTimerRef.current = null;
      }, 300);
    }
  }, []);

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
    if (window.location.pathname === '/') {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    navigate('/', { state: { scrollTo: id } });
  };

  // Drawer anchor links: record the target, then close. The actual navigation
  // is performed by the pending-anchor effect once the drawer has unmounted,
  // so ScrollToTop runs its smooth scroll on an unlocked document.
  const handleDrawerAnchor = (e, id) => {
    e.preventDefault();
    pendingAnchorRef.current = id;
    closeMobile();
  };

  // Drawer route links navigate via React Router immediately. Mark the close
  // as navigation-intent so the scroll-lock cleanup does not restore the old
  // page's scroll offset onto the destination page.
  const handleDrawerRouteNav = () => {
    restoreScrollRef.current = false;
    closeMobile();
  };

  const handleDrawerSwitchRole = () => {
    restoreScrollRef.current = false;
    handleSwitchRole();
    closeMobile();
  };

  const handleDrawerLogout = (e) => {
    restoreScrollRef.current = false;
    handleLogout(e);
    closeMobile();
  };

  const handleLogoClick = (e) => {
    closeMobile();
    if (window.location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
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
            <Link to="/register" className="sign-up-link btn btn-primary btn-sm">Sign up</Link>
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
                    className="account-menu-item account-menu-theme-toggle"
                    role="menuitem"
                    onClick={() => updateTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-pressed={theme === 'dark'}
                    aria-label="Toggle dark mode"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    Dark mode
                    <span className="toggle-switch" aria-hidden="true">
                      <span className={`toggle-thumb ${theme === 'dark' ? 'on' : ''}`} />
                    </span>
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
              <Link to="/register" className="sign-up-link btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>

        <button
          ref={hamburgerRef}
          className="mobile-toggle"
          onClick={() => mobileOpen ? closeMobile() : openMobile()}
          aria-expanded={mobileOpen}
          aria-controls="mobile-drawer"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <span className={`hamburger ${mobileOpen ? 'open' : ''}`} aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
        </button>
      </div>

      {/* Mobile drawer — portaled to body to escape header's backdrop-filter containing block */}
      {drawerMounted && createPortal(
        <>
          <div className={`mobile-drawer-backdrop ${mobileOpen ? 'active' : ''}`} onClick={closeMobile} aria-hidden="true" />
          <div
            ref={drawerRef}
            className={`mobile-drawer ${drawerActive ? 'mobile-drawer--open' : ''}`}
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="mobile-drawer-header">
              {user ? (
                <div className="mobile-drawer-account mobile-drawer-header-account">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="mobile-drawer-avatar" />
                  ) : (
                    <span className="mobile-drawer-avatar-placeholder">{userInitial}</span>
                  )}
                  <div className="mobile-drawer-account-text">
                    <span className="mobile-drawer-account-name">{user.fullName || user.email}</span>
                    <span className="mobile-drawer-account-role">{roleLabel}</span>
                  </div>
                </div>
              ) : (
                <span className="mobile-drawer-guest-label">Menu</span>
              )}
              <button
                ref={closeRef}
                className="mobile-drawer-close"
                onClick={closeMobile}
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="mobile-drawer-nav" aria-label="Mobile navigation">
              {/* Switch to Recruiter — above Navigation */}
              {user && (
                <div className="mobile-drawer-section">
                  <button
                    type="button"
                    className="mobile-drawer-link"
                    onClick={handleDrawerSwitchRole}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 1l4 4-4 4" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <span className="mobile-drawer-label">{switchLabel}</span>
                  </button>
                </div>
              )}

              {/* Navigation links */}
              <div className="mobile-drawer-section">
                <span className="mobile-drawer-section-label">Navigation</span>
                {links.map(link => (
                  link.scrollTo ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className="mobile-drawer-link"
                      onClick={(e) => handleDrawerAnchor(e, link.scrollTo)}
                    >
                      <span className="mobile-drawer-label">{link.label}</span>
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      to={link.href}
                      className="mobile-drawer-link"
                      onClick={handleDrawerRouteNav}
                    >
                      <span className="mobile-drawer-label">{link.label}</span>
                    </Link>
                  )
                ))}
              </div>

              {/* Account links for logged-in users */}
              {user && (
                <div className="mobile-drawer-section">
                  <span className="mobile-drawer-section-label">Account</span>
                  <Link
                    to="/profile"
                    className="mobile-drawer-link"
                    onClick={handleDrawerRouteNav}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="mobile-drawer-label">Profile</span>
                  </Link>
                  {user.role === 'jobseeker' && (
                    <>
                      <Link
                        to="/saved-jobs"
                        className="mobile-drawer-link"
                        onClick={handleDrawerRouteNav}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span className="mobile-drawer-label">Saved Jobs</span>
                      </Link>
                      <Link
                        to="/profile?tab=my-applications"
                        className="mobile-drawer-link"
                        onClick={handleDrawerRouteNav}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                        <span className="mobile-drawer-label">Applications</span>
                      </Link>
                    </>
                  )}
                  {user.role === 'recruiter' && (
                    <Link
                      to="/profile?tab=post"
                      className="mobile-drawer-link"
                      onClick={handleDrawerRouteNav}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <span className="mobile-drawer-label">Post a Job</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    className="mobile-drawer-link mobile-drawer-theme-toggle"
                    onClick={() => updateTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-pressed={theme === 'dark'}
                    aria-label="Toggle dark mode"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    <span className="mobile-drawer-label">Dark mode</span>
                    <span className="toggle-switch" aria-hidden="true">
                      <span className={`toggle-thumb ${theme === 'dark' ? 'on' : ''}`} />
                    </span>
                  </button>
                </div>
              )}

              {/* Guest: Sign in / Sign up */}
              {!user && (
                <div className="mobile-drawer-section">
                  <Link
                    to="/login"
                    className="btn btn-secondary btn-full"
                    onClick={handleDrawerRouteNav}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary btn-full"
                    onClick={handleDrawerRouteNav}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </nav>

            {/* Logout — completely separate at the bottom */}
            {user && (
              <div className="mobile-drawer-logout">
                <button
                  type="button"
                  className="mobile-drawer-link mobile-drawer-link--danger"
                  onClick={handleDrawerLogout}
                  disabled={loggingOut}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="mobile-drawer-label">{loggingOut ? 'Logging out…' : 'Log out'}</span>
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </header>
  );
}

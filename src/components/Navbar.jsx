import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import './Navbar.css';
import { useTheme } from '../hooks/useTheme';

const LOGOUT_VISIBLE_MS = 750;
const AVATAR_BASE = 'http://localhost:5000';

const MOON_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SUN_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export default function Navbar() {
  const { user, logout, toggleRole } = useAuth();
  const { theme, updateTheme } = useTheme();
  const toggleTheme = () => updateTheme(theme === 'dark' ? 'light' : 'dark');
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
  const restoreDrawerFocusRef = useRef(true);

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

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMobile();
        return;
      }
      if (e.key !== 'Tab') return;

      const container = drawerRef.current;
      if (!container) return;

      const candidates = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'
      );
      const focusable = Array.from(candidates).filter((el) => {
        if (el.tabIndex < 0) return false;
        if (el.hasAttribute('disabled')) return false;
        if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
        if (el.getClientRects().length === 0) return false;
        return window.getComputedStyle(el).visibility !== 'hidden';
      });

      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      // Restore the pre-open scroll position, UNLESS a drawer route link
      // initiated navigation that changed the page - restoring the old offset
      // onto the destination page would sabotage its intended scroll position.
      if (restoreScrollRef.current) {
        window.scrollTo(0, scrollY);
      }
      document.removeEventListener('keydown', handleKeyDown);
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
    restoreDrawerFocusRef.current = true;
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
    // Return focus to the hamburger unless this close was triggered by
    // navigation taking the user to another page.
    if (restoreDrawerFocusRef.current && hamburgerRef.current) {
      hamburgerRef.current.focus();
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
      // A role switch always lands on the homepage at the very top. Replace
      // the current entry with "/" so the reload isn't tied to whatever page
      // the user was on, and suspend the browser's native scroll restoration
      // for this reload so it can't drop them back to a previous scroll
      // offset. ScrollToTop re-enables native restoration on the fresh mount.
      history.scrollRestoration = 'manual';
      window.location.replace('/');
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
    restoreDrawerFocusRef.current = false;
    closeMobile();
  };

  // Drawer route links navigate via React Router immediately. Mark the close
  // as navigation-intent so the scroll-lock cleanup does not restore the old
  // page's scroll offset onto the destination page.
  const handleDrawerRouteNav = () => {
    restoreScrollRef.current = false;
    restoreDrawerFocusRef.current = false;
    closeMobile();
  };

  const handleDrawerSwitchRole = () => {
    restoreScrollRef.current = false;
    restoreDrawerFocusRef.current = false;
    handleSwitchRole();
    closeMobile();
  };

  const handleDrawerLogout = (e) => {
    restoreScrollRef.current = false;
    restoreDrawerFocusRef.current = false;
    handleLogout(e);
    closeMobile();
  };

  const handleLogoClick = (e) => {
    restoreDrawerFocusRef.current = false;
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

  const isLoginPage = location.pathname === '/login';
  const isRegisterPage = location.pathname === '/register';
  const isAuthPage = isLoginPage || isRegisterPage;

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
            {isLoginPage && (
              <Link to="/register" className="sign-in-link">Sign up</Link>
            )}
            {isRegisterPage && (
              <Link to="/login" className="sign-in-link">Sign in</Link>
            )}
            <button
              type="button"
              className="navbar-theme-toggle"
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? SUN_ICON : MOON_ICON}
            </button>
          </div>
        </div>
      </header>
    );
  }

  const roleLabel =
    user?.role === 'admin'
      ? 'Administrator'
      : user?.role === 'recruiter'
        ? 'Recruiter'
        : 'Jobseeker';
  const switchLabel = user?.role === 'recruiter' ? 'Switch to Jobseeker' : 'Switch to Recruiter';
  const avatarSrc = user?.avatarUrl ? `${AVATAR_BASE}${user.avatarUrl}` : null;

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
                <Avatar
                  src={avatarSrc}
                  imgClassName="account-avatar-img"
                  placeholderClassName="account-avatar-placeholder"
                  iconSize={20}
                />
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
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="account-menu-item"
                      role="menuitem"
                      onClick={handleProfileNavigate}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="9" rx="1" />
                        <rect x="14" y="3" width="7" height="5" rx="1" />
                        <rect x="14" y="12" width="7" height="9" rx="1" />
                        <rect x="3" y="16" width="7" height="5" rx="1" />
                      </svg>
                      Admin Dashboard
                    </Link>
                  )}
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
                    <>
                      <Link
                        to="/dashboard"
                        className="account-menu-item"
                        role="menuitem"
                        onClick={handleProfileNavigate}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="3" width="7" height="9" rx="1" />
                          <rect x="14" y="3" width="7" height="5" rx="1" />
                          <rect x="14" y="12" width="7" height="9" rx="1" />
                          <rect x="3" y="16" width="7" height="5" rx="1" />
                        </svg>
                        Admin Dashboard
                      </Link>
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
                    </>
                  )}
                  {user.role !== 'admin' && (
                    <>
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
                  </>
                )}
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
              <button
                type="button"
                className="navbar-theme-toggle"
                onClick={toggleTheme}
                aria-pressed={theme === 'dark'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? SUN_ICON : MOON_ICON}
              </button>
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

      {/* Mobile drawer - portaled to body to escape header's backdrop-filter containing block */}
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
                  <Avatar
                    src={avatarSrc}
                    imgClassName="mobile-drawer-avatar"
                    placeholderClassName="mobile-drawer-avatar-placeholder"
                    iconSize={20}
                  />
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
              {/* Switch to Recruiter - above Navigation */}
              {user && user.role !== 'admin' && (
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
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="mobile-drawer-link"
                      onClick={handleDrawerRouteNav}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="9" rx="1" />
                        <rect x="14" y="3" width="7" height="5" rx="1" />
                        <rect x="14" y="12" width="7" height="9" rx="1" />
                        <rect x="3" y="16" width="7" height="5" rx="1" />
                      </svg>
                      <span className="mobile-drawer-label">Admin Dashboard</span>
                    </Link>
                  )}
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
                    <>
                      <Link
                        to="/dashboard"
                        className="mobile-drawer-link"
                        onClick={handleDrawerRouteNav}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="3" width="7" height="9" rx="1" />
                          <rect x="14" y="3" width="7" height="5" rx="1" />
                          <rect x="14" y="12" width="7" height="9" rx="1" />
                          <rect x="3" y="16" width="7" height="5" rx="1" />
                        </svg>
                        <span className="mobile-drawer-label">Admin Dashboard</span>
                      </Link>
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
                    </>
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
                  <span className="mobile-drawer-section-label">Preferences</span>
                  <button
                    type="button"
                    className="mobile-drawer-link mobile-drawer-theme-toggle"
                    onClick={toggleTheme}
                    aria-pressed={theme === 'dark'}
                    aria-label="Toggle dark mode"
                  >
                    {MOON_ICON}
                    <span className="mobile-drawer-label">Dark mode</span>
                    <span className="toggle-switch" aria-hidden="true">
                      <span className={`toggle-thumb ${theme === 'dark' ? 'on' : ''}`} />
                    </span>
                  </button>
                  <span className="mobile-drawer-section-label">Account</span>
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

            {/* Logout - completely separate at the bottom */}
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

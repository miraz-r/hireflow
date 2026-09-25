import { useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import Avatar from '../Avatar';
import AdminProfileMenu from './AdminProfileMenu';
import useDismissible from '../../hooks/useDismissible';
import { resolveMediaUrl } from '../../lib/media';
import './AdminTopbar.css';

const MENU_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);

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

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BELL_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

function getPageTitle(pathname) {
  if (pathname === '/admin') return 'Overview';
  if (pathname === '/admin/account') return 'Account';
  if (pathname === '/admin/jobs' || pathname.startsWith('/admin/jobs/')) return 'Jobs';
  if (pathname === '/admin/applications' || pathname.startsWith('/admin/applications/')) return 'Applications';
  if (pathname === '/admin/recruiters' || pathname.startsWith('/admin/recruiters/')) return 'Recruiters';
  if (pathname === '/admin/companies' || pathname.startsWith('/admin/companies/')) return 'Companies';
  if (pathname === '/admin/jobseekers' || pathname.startsWith('/admin/jobseekers/')) return 'Jobseekers';
  if (pathname === '/admin/analytics' || pathname.startsWith('/admin/analytics/')) return 'Analytics';
  if (pathname === '/admin/activity' || pathname.startsWith('/admin/activity/')) return 'Activity';
  return 'Page not found';
}

/**
 * AdminTopbar - white topbar with a route-aware page title on the left and
 * the global search field, notification control, and profile control on the
 * right. The search is a visual-only shell component in Phase 1A.
 */
export default function AdminTopbar({ openBtnRef, drawerOpen, onOpenDrawer }) {
  const location = useLocation();
  const { theme, updateTheme } = useTheme();
  const toggleTheme = () => updateTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <header className="admin-topbar">
      <button
        ref={openBtnRef}
        type="button"
        className="admin-topbar-menu-btn"
        onClick={onOpenDrawer}
        aria-expanded={drawerOpen}
        aria-controls="admin-sidebar"
        aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
      >
        {MENU_ICON}
      </button>

      <h1 className="admin-topbar-title">{getPageTitle(location.pathname)}</h1>

      <div className="admin-topbar-search">
        <label className="sr-only" htmlFor="admin-global-search">
          Search jobs, applications, users
        </label>
        {SEARCH_ICON}
        <input
          id="admin-global-search"
          className="admin-topbar-search-input"
          type="search"
          placeholder="Search jobs, applications, users..."
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      <div className="admin-topbar-group">
        <button
          type="button"
          className="admin-icon-btn"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? SUN_ICON : MOON_ICON}
        </button>
      </div>

      <NotificationControl />
      <TopbarProfileControl />
    </header>
  );
}

/**
 * Notification control - read-only presentation. There is no admin notification
 * system yet, so opening it shows a static empty state (no fabricated data).
 */
function NotificationControl() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closePopover = useCallback(() => setOpen(false), []);

  useDismissible(open, wrapRef, closePopover);

  return (
    <div className="admin-topbar-group" ref={wrapRef}>
      <button
        type="button"
        className="admin-icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Notifications"
        title="No unread notifications"
      >
        {BELL_ICON}
      </button>

      {open && (
        <div className="admin-popover" role="region" aria-label="Notifications">
          <div className="admin-popover-header">
            <strong>Notifications</strong>
          </div>
          <div className="admin-popover-empty">
            {BELL_ICON}
            <p>You&rsquo;re all caught up.</p>
            <span>New notifications will appear here.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Profile control - compact administrator avatar that opens the shared,
 * limited account menu (public site + sign out) using the real user.
 */
function TopbarProfileControl() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  const avatarSrc = resolveMediaUrl(user?.avatarUrl);

  useDismissible(open, wrapRef, closeMenu);

  return (
    <div className="admin-topbar-group" ref={wrapRef}>
      <button
        type="button"
        className="admin-icon-btn admin-avatar-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <Avatar
          src={avatarSrc}
          imgClassName="admin-topbar-avatar"
          placeholderClassName="admin-topbar-avatar-placeholder"
          iconSize={16}
        />
      </button>

      {open && <AdminProfileMenu onClose={closeMenu} />}
    </div>
  );
}
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../Avatar';
import './AdminSidebar.css';

const AVATAR_BASE = 'http://localhost:5000';

const mk = (children, size = 18, extraClassName) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={extraClassName}
  >
    {children}
  </svg>
);

const ICON_OVERVIEW = mk(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>
);
const ICON_JOBS = mk(
  <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>
);
const ICON_APPLICATIONS = mk(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </>
);
const ICON_RECRUITERS = mk(
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);
const ICON_COMPANIES = mk(
  <>
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
  </>
);
const ICON_JOBSEEKERS = mk(
  <>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
);
const ICON_ANALYTICS = mk(
  <>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </>
);
const ICON_ACTIVITY = mk(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const ICON_SETTINGS = mk(
  <>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </>
);
const ICON_LOCK = mk(
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
  14,
  'admin-nav-lock'
);

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ id: 'overview', label: 'Overview', to: '/admin', icon: ICON_OVERVIEW, end: true }],
  },
  {
    label: 'Manage',
    items: [
      { id: 'jobs', label: 'Jobs', to: '/admin/jobs', icon: ICON_JOBS },
      { id: 'applications', label: 'Applications', to: '/admin/applications', icon: ICON_APPLICATIONS },
      { id: 'recruiters', label: 'Recruiters', icon: ICON_RECRUITERS, disabled: true },
      { id: 'companies', label: 'Companies', icon: ICON_COMPANIES, disabled: true },
      { id: 'jobseekers', label: 'Jobseekers', icon: ICON_JOBSEEKERS, disabled: true },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', icon: ICON_ANALYTICS, disabled: true },
      { id: 'activity', label: 'Activity', icon: ICON_ACTIVITY, disabled: true },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', icon: ICON_SETTINGS, disabled: true },
    ],
  },
];

/**
 * AdminSidebar - persistent light sidebar on desktop; off-canvas drawer on
 * mobile. Contains the HireFlow branding, the approved navigation hierarchy,
 * and the administrator profile footer.
 */
export default function AdminSidebar({ drawerRef, closeBtnRef, onClose, onNavigate }) {
  return (
    <aside id="admin-sidebar" ref={drawerRef} className="admin-sidebar" aria-label="Admin navigation sidebar">
      <div className="admin-sidebar-header">
        <Link to="/" className="admin-brand" aria-label="HireFlow home" onClick={onNavigate}>
          <svg className="admin-brand-icon" width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#4f46e5" />
            <path d="M9 11h14v2.5H9zm0 5h10v2.5H9zm0 5h12v2.5H9z" fill="white" />
          </svg>
          <span className="admin-brand-name">HireFlow</span>
        </Link>
        <span className="admin-brand-badge">Admin</span>
        <button
          ref={closeBtnRef}
          type="button"
          className="admin-drawer-close"
          onClick={onClose}
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Admin sections">
        {NAV_SECTIONS.map((section) => (
          <div className="admin-nav-section" key={section.label}>
            <div className="admin-nav-section-label">{section.label}</div>
            <ul className="admin-nav-list">
              {section.items.map((item) => (
                <li className="admin-nav-item" key={item.id}>
                  {item.disabled ? (
                    <button
                      type="button"
                      className="admin-nav-link admin-nav-link--disabled"
                      disabled
                      aria-disabled="true"
                      title="Available in a later phase"
                    >
                      {item.icon}
                      <span className="admin-nav-text">{item.label}</span>
                      {ICON_LOCK}
                    </button>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`
                      }
                      onClick={onNavigate}
                    >
                      {item.icon}
                      <span className="admin-nav-text">{item.label}</span>
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <SidebarProfileFooter />
    </aside>
  );
}

/**
 * Profile footer - non-interactive identity block for the signed-in
 * administrator. Account actions live exclusively in the topbar avatar menu.
 */
function SidebarProfileFooter() {
  const { user } = useAuth();
  const avatarSrc = user?.avatarUrl ? `${AVATAR_BASE}${user.avatarUrl}` : null;

  return (
    <div className="admin-sidebar-profile">
      <div className="admin-profile-identity">
        <Avatar
          src={avatarSrc}
          imgClassName="admin-profile-avatar"
          placeholderClassName="admin-profile-avatar-placeholder"
          iconSize={18}
        />
        <span className="admin-profile-meta">
          <span className="admin-profile-name">{user?.fullName || 'Administrator'}</span>
          <span className="admin-profile-role">Administrator</span>
        </span>
      </div>
    </div>
  );
}
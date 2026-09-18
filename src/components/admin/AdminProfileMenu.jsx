import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AdminProfileMenu.css';

/**
 * AdminProfileMenu - the compact account dropdown shared by the sidebar
 * profile footer and the topbar profile control. Limited to functionality
 * that already exists: view the public site and sign out.
 */
export default function AdminProfileMenu({ openUp = false, onClose, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navigateAndClose = () => {
    onClose?.();
    onNavigate?.();
  };

  const handleSignOut = () => {
    onClose?.();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      className={`admin-profile-menu${openUp ? ' admin-profile-menu--up' : ''}`}
      role="menu"
      aria-label="Account menu"
    >
      <div className="admin-profile-menu-header">
        <strong className="admin-profile-menu-name">{user?.fullName || 'Administrator'}</strong>
        <span className="admin-profile-menu-email">{user?.email}</span>
      </div>

      <div className="admin-profile-menu-divider" />

      <Link to="/" className="admin-profile-menu-item" role="menuitem" onClick={navigateAndClose}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        View public site
      </Link>

      <button type="button" className="admin-profile-menu-item" role="menuitem" onClick={handleSignOut}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </div>
  );
}
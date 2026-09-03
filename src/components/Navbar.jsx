import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, toggleRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/');
  };

  const handleToggleRole = async (role) => {
    if (role === user?.role || roleChanging) return;
    setRoleChanging(true);
    try {
      await toggleRole(role);
    } catch {
      // leave role unchanged; toggleRole failure keeps prior state
    } finally {
      setRoleChanging(false);
    }
  };

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
          {user ? (
            <div className="user-menu">
              <div className="role-toggle" role="group" aria-label="Account mode">
                <button
                  type="button"
                  className={`role-toggle-btn ${user.role === 'jobseeker' ? 'active' : ''}`}
                  onClick={() => handleToggleRole('jobseeker')}
                  disabled={roleChanging}
                >
                  Jobseeker
                </button>
                <button
                  type="button"
                  className={`role-toggle-btn ${user.role === 'recruiter' ? 'active' : ''}`}
                  onClick={() => handleToggleRole('recruiter')}
                  disabled={roleChanging}
                >
                  Recruiter
                </button>
              </div>
              {user.role === 'recruiter' ? (
                <Link to="/profile?tab=post" className="post-job-link">Post a job</Link>
              ) : (
                <Link to="/profile" className="profile-link">My Profile</Link>
              )}
              <span className="user-email">{user.email}</span>
              <button className="logout-btn" onClick={handleLogout} type="button">
                Logout
              </button>
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
              <a
                key={link.label}
                href={link.href}
                className="mobile-link"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mobile-actions">
              {user ? (
                <>
                  <div className="mobile-user-info">
                    <span className="mobile-user-email">{user.email}</span>
                    <div className="role-toggle" role="group" aria-label="Account mode">
                      <button
                        type="button"
                        className={`role-toggle-btn ${user.role === 'jobseeker' ? 'active' : ''}`}
                        onClick={() => handleToggleRole('jobseeker')}
                        disabled={roleChanging}
                      >
                        Jobseeker
                      </button>
                      <button
                        type="button"
                        className={`role-toggle-btn ${user.role === 'recruiter' ? 'active' : ''}`}
                        onClick={() => handleToggleRole('recruiter')}
                        disabled={roleChanging}
                      >
                        Recruiter
                      </button>
                    </div>
                    <Link
                      to="/profile"
                      className="btn btn-secondary btn-full"
                      onClick={() => setMobileOpen(false)}
                    >
                      {user.role === 'recruiter' ? 'Company profile' : 'My Profile'}
                    </Link>
                    <button
                      className="btn btn-primary btn-full"
                      onClick={handleLogout}
                      type="button"
                    >
                      Logout
                    </button>
                  </div>
                </>
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

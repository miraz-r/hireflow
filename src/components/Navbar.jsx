import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, toggleRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = (e) => {
    e.preventDefault();
    if (loggingOut) return; // prevent accidental repeated logout clicks
    setLoggingOut(true);
    logout();
    setMobileOpen(false);
    navigate('/');
  };

  // Full reload after a successful role switch guarantees no stale
  // jobseeker/recruiter UI or form state survives the transition.
  const handleToggleRole = async (role) => {
    if (role === user?.role || roleChanging) return;
    setRoleChanging(true);
    try {
      await toggleRole(role);
      window.location.reload();
      return; // page reload — do not clear the changing flag
    } catch {
      // role unchanged; toggleRole failure keeps prior state — no reload
    } finally {
      setRoleChanging(false);
    }
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
    navigate('/');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const links = [
    { label: 'Find Jobs', href: '/#jobs', scrollTo: 'jobs' },
    { label: 'Companies', href: '/#companies', scrollTo: 'companies' },
    { label: 'Resources', href: '/resources' }
  ];

  return (
    <header className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand" aria-label="HireFlow home" onClick={() => setMobileOpen(false)}>
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
              <button
                className={`logout-btn ${loggingOut ? 'logging-out' : ''}`}
                onClick={handleLogout}
                type="button"
                disabled={loggingOut}
              >
                {loggingOut ? 'Logging out…' : 'Logout'}
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
                    to={user.role === 'recruiter' ? '/profile?tab=post' : '/profile'}
                    className="btn btn-secondary btn-full"
                    onClick={() => setMobileOpen(false)}
                  >
                    {user.role === 'recruiter' ? 'Company profile' : 'My Profile'}
                  </Link>
                  <button
                    className="btn btn-primary btn-full"
                    onClick={handleLogout}
                    type="button"
                    disabled={loggingOut}
                  >
                    {loggingOut ? 'Logging out…' : 'Logout'}
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

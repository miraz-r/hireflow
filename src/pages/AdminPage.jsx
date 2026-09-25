import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminShell from '../components/admin/AdminShell';
import AdminOverview from '../components/admin/AdminOverview';
import AdminJobsPage from '../components/admin/AdminJobsPage';
import AdminApplicationsPage from '../components/admin/AdminApplicationsPage';
import AdminRecruitersPage from '../components/admin/AdminRecruitersPage';
import AdminCompaniesPage from '../components/admin/AdminCompaniesPage';
import AdminJobseekersPage from '../components/admin/AdminJobseekersPage';
import AdminAnalyticsPage from '../components/admin/AdminAnalyticsPage';
import AdminActivityPage from '../components/admin/AdminActivityPage';
import AdminAccountPage from './AdminAccountPage';
import './AdminPage.css';

/**
 * AdminPage - the Admin area entry point (/admin/*).
 *
 * Keeps the Phase 0 role rules intact:
 *   admin     → Admin Shell
 *   recruiter → /dashboard
 *   jobseeker → /
 *   guest     → /login
 *
 * Phase 1C wires /admin/jobs to the Jobs workspace (Job Moderation). The
 * :jobId detail is handled by the same workspace view.
 */
export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.role === 'recruiter') {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (user.role === 'jobseeker') {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return <div className="app-loading" aria-busy="true" />;
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <AdminShell>
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="account" element={<AdminAccountPage />} />
        <Route path="jobs" element={<AdminJobsPage />} />
        <Route path="jobs/:jobId" element={<AdminJobsPage />} />
        <Route path="applications" element={<AdminApplicationsPage />} />
        <Route path="recruiters" element={<AdminRecruitersPage />} />
        <Route path="companies" element={<AdminCompaniesPage />} />
        <Route path="jobseekers" element={<AdminJobseekersPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="*" element={<NotFoundPlaceholder />} />
      </Routes>
    </AdminShell>
  );
}

/* ======================================================================= */
/* Fallback - only rendered for routes outside /admin, /admin/account,      */
/* /admin/jobs.                                                             */
/* ======================================================================= */

function AdminPlaceholder({ kicker, title, text, route }) {
  return (
    <div className="admin-page">
      <div className="admin-placeholder">
        <span className="admin-placeholder-kicker">{kicker}</span>
        <h2 className="admin-placeholder-title">{title}</h2>
        <p className="admin-placeholder-text">{text}</p>
        <code className="admin-placeholder-route">{route}</code>
      </div>
    </div>
  );
}

function NotFoundPlaceholder() {
  const { pathname } = useLocation();
  return (
    <AdminPlaceholder
      kicker="Admin"
      title="Page not found"
      text="This admin route does not exist yet. The Admin Shell itself is working correctly."
      route={pathname}
    />
  );
}

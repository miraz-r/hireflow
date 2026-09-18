import { useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminShell from '../components/admin/AdminShell';
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
 * Phase 1A renders only the reusable Admin Shell plus minimal placeholders to
 * prove routing works. The real Overview / Jobs / Job Detail pages arrive in
 * Phase 1B / 1C / 1D.
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
        <Route index element={<OverviewPlaceholder />} />
        <Route path="jobs" element={<JobsManagementPlaceholder />} />
        <Route path="jobs/:jobId" element={<JobDetailPlaceholder />} />
        <Route path="*" element={<NotFoundPlaceholder />} />
      </Routes>
    </AdminShell>
  );
}

/* ======================================================================= */
/* Phase 1A placeholders - minimal, internal, proof of routing only.       */
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

function OverviewPlaceholder() {
  return (
    <AdminPlaceholder
      kicker="Phase 1B · Next"
      title="Overview"
      text="The full Admin Overview dashboard will be built in Phase 1B. This placeholder verifies that /admin routes through the Admin Shell correctly."
      route="/admin"
    />
  );
}

function JobsManagementPlaceholder() {
  return (
    <AdminPlaceholder
      kicker="Phase 1C · Next"
      title="Jobs"
      text="Jobs Management - the list, filters and actions - will be built in Phase 1C. This placeholder verifies that /admin/jobs routes through the Admin Shell correctly."
      route="/admin/jobs"
    />
  );
}

function JobDetailPlaceholder() {
  const { jobId } = useParams();
  return (
    <AdminPlaceholder
      kicker="Phase 1D · Next"
      title="Job Detail"
      text="The administrative job detail page will be built in Phase 1D. The :jobId URL parameter is being read correctly and passed through the shell."
      route={`/admin/jobs/${jobId}`}
    />
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
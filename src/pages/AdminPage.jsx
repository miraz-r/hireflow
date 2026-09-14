import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RecruiterDashboard from '../components/RecruiterDashboard';
import './AdminPage.css';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.role === 'jobseeker') {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return <div className="app-loading" aria-busy="true" />;
  }

  // The redirect effects above handle guests and jobseekers; only recruiters
  // render the dashboard.
  if (!user || user.role !== 'recruiter') {
    return null;
  }

  return (
    <div className="admin-page">
      <div className="container">
        <RecruiterDashboard />
      </div>
    </div>
  );
}
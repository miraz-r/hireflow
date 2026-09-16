import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

function getActiveTab(pathname, tabParam) {
  if (pathname === '/saved-jobs') return 'saved-jobs';
  if (pathname === '/profile') {
    if (tabParam === 'my-applications') return 'my-applications';
    if (tabParam === 'saved-jobs') return 'saved-jobs';
    if (tabParam === 'post') return 'post';
  }
  return 'profile';
}

export default function ProfileTabs({ role }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const active = getActiveTab(pathname, searchParams.get('tab'));
  const isJobseeker = role === 'jobseeker';
  const isRecruiter = role === 'recruiter';

  const go = (tab) => {
    if (tab === 'my-applications') navigate('/profile?tab=my-applications');
    else if (tab === 'saved-jobs') navigate('/saved-jobs');
    else if (tab === 'post') navigate('/profile?tab=post');
    else navigate('/profile');
  };

  return (
    <div className="profile-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'profile'}
        className={`profile-tab ${active === 'profile' ? 'active' : ''}`}
        onClick={() => go('profile')}
      >
        Profile
      </button>
      {isJobseeker && (
        <>
          <button
            type="button"
            role="tab"
            aria-selected={active === 'my-applications'}
            className={`profile-tab ${active === 'my-applications' ? 'active' : ''}`}
            onClick={() => go('my-applications')}
          >
            Applications
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active === 'saved-jobs'}
            className={`profile-tab ${active === 'saved-jobs' ? 'active' : ''}`}
            onClick={() => go('saved-jobs')}
          >
            Saved Jobs
          </button>
        </>
      )}
      {isRecruiter && (
        <button
          type="button"
          role="tab"
          aria-selected={active === 'post'}
          className={`profile-tab ${active === 'post' ? 'active' : ''}`}
          onClick={() => go('post')}
        >
          Post a job
        </button>
      )}
    </div>
  );
}
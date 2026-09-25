import { Link } from 'react-router-dom';
import { RECENT_ACTIVITY } from './adminAnalyticsData';
import './AdminActivityPage.css';

const ARROW_LEFT_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/**
 * AdminActivityPage - the /admin/activity workspace, and the destination of the
 * Analytics "View all activity" link.
 *
 * Deliberately minimal: the platform activity feed is a read-only list, so this
 * is one card holding the complete feed. It renders the same records the
 * Analytics table shows (RECENT_ACTIVITY, imported from the shared report data
 * rather than re-declared), so following the link can never reveal rows the
 * Analytics page was hiding.
 *
 * There is no endpoint yet, so there is no pagination, filtering or per-row
 * action to wire up: adding a filter that cannot filter anything, or a row menu
 * whose items would have nowhere to go, would be inventing functionality. The
 * "Back to Analytics" link is the one real navigation affordance, and it returns
 * to where the admin came from.
 */
export default function AdminActivityPage() {
  const total = RECENT_ACTIVITY.length;

  return (
    <div className="admin-page admin-activity">
      <section className="admin-activity-card" aria-labelledby="admin-activity-title">
        <div className="admin-activity-card-head">
          <div className="admin-activity-card-headings">
            <h2 className="admin-activity-card-title" id="admin-activity-title">
              Platform Activity
            </h2>
            <p className="admin-activity-card-sub">
              Newest first. Jobs posted, applications received, and new accounts.
            </p>
          </div>
          <Link to="/admin/analytics" className="admin-activity-back">
            {ARROW_LEFT_ICON}
            Back to Analytics
          </Link>
        </div>

        <div className="admin-activity-table-scroll">
          <table className="admin-activity-table">
            <colgroup>
              <col className="admin-activity-col-activity" />
              <col className="admin-activity-col-user" />
              <col className="admin-activity-col-date" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Activity</th>
                <th scope="col">User</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_ACTIVITY.map((row) => (
                <tr key={`${row.activity}-${row.user}`}>
                  <td className="admin-activity-cell-activity">{row.activity}</td>
                  <td className="admin-activity-cell-user">{row.user}</td>
                  <td className="admin-activity-cell-date">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="admin-activity-foot">
          <p className="admin-activity-foot-count">
            Showing <strong>{total}</strong> recent {total === 1 ? 'event' : 'events'}
          </p>
        </footer>
      </section>
    </div>
  );
}

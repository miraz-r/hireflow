import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import Select from '../ui/Select';
import Toast from '../Toast';
import Avatar from '../Avatar';
import { avatarFallback } from '../../lib/media';
import './AdminApplicationsPage.css';

const PAGE_SIZE = 10;

const STATUS_META = {
  new: { label: 'New', tone: 'new' },
  reviewing: { label: 'Reviewing', tone: 'reviewing' },
  shortlisted: { label: 'Shortlisted', tone: 'shortlisted' },
  interview: { label: 'Interview', tone: 'interview' },
  rejected: { label: 'Rejected', tone: 'rejected' },
  hired: { label: 'Hired', tone: 'hired' },
};
const STATUS_OPTIONS = Object.keys(STATUS_META);

const DATE_OPTIONS = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const X_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DOC_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const CHECK_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MORE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

const ARROW_LEFT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ARROW_RIGHT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// Relative dates keep the date filters meaningful no matter when the page is
// viewed. Part 1 renders UI mock data because the existing admin applications
// endpoint is a slim Overview feed (no email, no filters) and backend changes
// are out of scope for this phase.
const daysAgo = (n) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
};

const MOCK_APPLICATIONS = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah.johnson@email.com', job: 'Frontend Developer', company: 'Stark Industries', recruiter: 'Olivia Bennett', status: 'new', appliedAt: daysAgo(0), location: 'New York, NY', experience: '5 years', skills: ['React', 'TypeScript', 'Node.js'], phone: '(809) 345-7670', resume: 'Resume.pdf' },
  { id: '2', name: 'Michael Chen', email: 'michael.chen@email.com', job: 'Backend Engineer', company: 'LexCorp', recruiter: 'Marcus Webb', status: 'interview', appliedAt: daysAgo(1), location: 'San Francisco, CA', experience: '6 years', skills: ['Node.js', 'PostgreSQL', 'Docker'], phone: '(415) 220-8841', resume: 'Resume.pdf' },
  { id: '3', name: 'Emily Davis', email: 'emily.davis@email.com', job: 'Product Designer', company: 'Aperture Science', recruiter: 'Priya Raman', status: 'shortlisted', appliedAt: daysAgo(2), location: 'Austin, TX', experience: '4 years', skills: ['Figma', 'Prototyping', 'UX Research'], phone: '(512) 774-3319', resume: 'Resume.pdf' },
  { id: '4', name: 'James Rodriguez', email: 'james.rodriguez@email.com', job: 'Frontend Developer', company: 'Stark Industries', recruiter: 'Olivia Bennett', status: 'reviewing', appliedAt: daysAgo(2), location: 'Chicago, IL', experience: '3 years', skills: ['React', 'TypeScript', 'CSS'], phone: '(312) 558-9072', resume: 'Resume.pdf' },
  { id: '5', name: 'Aisha Khan', email: 'aisha.khan@email.com', job: 'Data Analyst', company: 'Hooli', recruiter: 'Daniel Cho', status: 'new', appliedAt: daysAgo(3), location: 'Boston, MA', experience: '5 years', skills: ['SQL', 'Python', 'Tableau'], phone: '(617) 483-2210', resume: 'Resume.pdf' },
  { id: '6', name: 'Tom Becker', email: 'tom.becker@email.com', job: 'DevOps Engineer', company: 'Umbrella Corp', recruiter: 'Sofia Marchetti', status: 'rejected', appliedAt: daysAgo(4), location: 'Denver, CO', experience: '7 years', skills: ['AWS', 'Kubernetes', 'CI/CD'], phone: '(303) 661-4408', resume: 'Resume.pdf' },
  { id: '7', name: 'Priya Patel', email: 'priya.patel@email.com', job: 'Marketing Manager', company: 'Wayne Enterprises', recruiter: 'James Kowalski', status: 'new', appliedAt: daysAgo(5), location: 'Seattle, WA', experience: '4 years', skills: ['SEO', 'Content Strategy', 'Analytics'], phone: '(206) 349-7715', resume: 'Resume.pdf' },
  { id: '8', name: 'Daniel Lopez', email: 'daniel.lopez@email.com', job: 'QA Engineer', company: 'Initech', recruiter: 'Elena Petrova', status: 'reviewing', appliedAt: daysAgo(6), location: 'Miami, FL', experience: '3 years', skills: ['Selenium', 'Cypress', 'Test Planning'], phone: '(305) 228-6194', resume: 'Resume.pdf' },
  { id: '9', name: 'Hannah Kim', email: 'hannah.kim@stark.com', job: 'Product Designer', company: 'Aperture Science', recruiter: 'Priya Raman', status: 'interview', appliedAt: daysAgo(7), location: 'Los Angeles, CA', experience: '6 years', skills: ['Figma', 'Design Systems', 'Wireframing'], phone: '(213) 907-5528', resume: 'Resume.pdf' },
  { id: '10', name: 'Oliver Smith', email: 'oliver.smith@email.com', job: 'Backend Engineer', company: 'LexCorp', recruiter: 'Marcus Webb', status: 'hired', appliedAt: daysAgo(8), location: 'New York, NY', experience: '8 years', skills: ['Node.js', 'GraphQL', 'AWS'], phone: '(917) 640-2287', resume: 'Resume.pdf' },
  { id: '11', name: 'Fatima Noor', email: 'fatima.noor@email.com', job: 'Data Analyst', company: 'Hooli', recruiter: 'Daniel Cho', status: 'shortlisted', appliedAt: daysAgo(9), location: 'Portland, OR', experience: '4 years', skills: ['SQL', 'Python', 'dbt'], phone: '(503) 712-9930', resume: 'Resume.pdf' },
  { id: '12', name: 'Ryan O Connor', email: 'ryan.oconnor@email.com', job: 'Frontend Developer', company: 'Stark Industries', recruiter: 'Olivia Bennett', status: 'reviewing', appliedAt: daysAgo(10), location: 'Philadelphia, PA', experience: '2 years', skills: ['React', 'JavaScript', 'Tailwind'], phone: '(215) 337-4401', resume: 'Resume.pdf' },
  { id: '13', name: 'Grace Liu', email: 'grace.liu@email.com', job: 'DevOps Engineer', company: 'Umbrella Corp', recruiter: 'Sofia Marchetti', status: 'interview', appliedAt: daysAgo(12), location: 'San Jose, CA', experience: '5 years', skills: ['Terraform', 'AWS', 'Kubernetes'], phone: '(408) 559-6623', resume: 'Resume.pdf' },
  { id: '14', name: 'Victor Almeida', email: 'victor.almeida@email.com', job: 'Marketing Manager', company: 'Wayne Enterprises', recruiter: 'James Kowalski', status: 'rejected', appliedAt: daysAgo(14), location: 'Atlanta, GA', experience: '6 years', skills: ['Email Marketing', 'SEO', 'Copywriting'], phone: '(404) 781-2246', resume: 'Resume.pdf' },
  { id: '15', name: 'Nina Petrova', email: 'nina.petrova@email.com', job: 'QA Engineer', company: 'Initech', recruiter: 'Elena Petrova', status: 'new', appliedAt: daysAgo(15), location: 'Charlotte, NC', experience: '4 years', skills: ['Cypress', 'Playwright', 'API Testing'], phone: '(704) 553-8821', resume: 'Resume.pdf' },
  { id: '16', name: 'Ethan Brooks', email: 'ethan.brooks@stark.com', job: 'Product Designer', company: 'Aperture Science', recruiter: 'Priya Raman', status: 'new', appliedAt: daysAgo(17), location: 'Nashville, TN', experience: '3 years', skills: ['Figma', 'Illustration', 'Prototyping'], phone: '(615) 428-3370', resume: 'Resume.pdf' },
  { id: '17', name: 'Maya Singh', email: 'maya.singh@email.com', job: 'Backend Engineer', company: 'LexCorp', recruiter: 'Marcus Webb', status: 'reviewing', appliedAt: daysAgo(19), location: 'San Diego, CA', experience: '5 years', skills: ['Node.js', 'Python', 'Redis'], phone: '(619) 507-1142', resume: 'Resume.pdf' },
  { id: '18', name: 'Lucas Meyer', email: 'lucas.meyer@email.com', job: 'Data Analyst', company: 'Hooli', recruiter: 'Daniel Cho', status: 'hired', appliedAt: daysAgo(21), location: 'Phoenix, AZ', experience: '7 years', skills: ['Python', 'SQL', 'Machine Learning'], phone: '(602) 844-9915', resume: 'Resume.pdf' },
  { id: '19', name: 'Zoe Carter', email: 'zoe.carter@email.com', job: 'Frontend Developer', company: 'Stark Industries', recruiter: 'Olivia Bennett', status: 'shortlisted', appliedAt: daysAgo(24), location: 'Minneapolis, MN', experience: '4 years', skills: ['React', 'TypeScript', 'Next.js'], phone: '(612) 339-7724', resume: 'Resume.pdf' },
  { id: '20', name: 'Adrian Foster', email: 'adrian.foster@aperture.com', job: 'DevOps Engineer', company: 'Umbrella Corp', recruiter: 'Sofia Marchetti', status: 'new', appliedAt: daysAgo(27), location: 'Salt Lake City, UT', experience: '6 years', skills: ['Docker', 'Jenkins', 'AWS'], phone: '(801) 557-2208', resume: 'Resume.pdf' },
  { id: '21', name: 'Natalia Reyes', email: 'natalia.reyes@email.com', job: 'Marketing Manager', company: 'Wayne Enterprises', recruiter: 'James Kowalski', status: 'reviewing', appliedAt: daysAgo(30), location: 'San Antonio, TX', experience: '5 years', skills: ['Social Media', 'Content Strategy', 'SEO'], phone: '(210) 664-3391', resume: 'Resume.pdf' },
  { id: '22', name: 'Marcus Hill', email: 'marcus.hill@email.com', job: 'QA Engineer', company: 'Initech', recruiter: 'Elena Petrova', status: 'shortlisted', appliedAt: daysAgo(34), location: 'Detroit, MI', experience: '5 years', skills: ['Selenium', 'JUnit', 'Regression Testing'], phone: '(313) 771-5580', resume: 'Resume.pdf' },
  { id: '23', name: 'Isabella Rossi', email: 'isabella.rossi@email.com', job: 'Product Designer', company: 'Aperture Science', recruiter: 'Priya Raman', status: 'interview', appliedAt: daysAgo(41), location: 'Boston, MA', experience: '6 years', skills: ['Figma', 'UX Research', 'Prototyping'], phone: '(617) 292-4413', resume: 'Resume.pdf' },
  { id: '24', name: 'Jordan Fields', email: 'jordan.fields@email.com', job: 'Backend Engineer', company: 'LexCorp', recruiter: 'Marcus Webb', status: 'rejected', appliedAt: daysAgo(55), location: 'Houston, TX', experience: '4 years', skills: ['Node.js', 'PostgreSQL', 'REST APIs'], phone: '(713) 448-9927', resume: 'Resume.pdf' },
  // The next four people are also listed on the Admin Jobseekers page, where
  // their recent applications are shown in the detail panel. These rows mirror
  // those entries so "View Applications" lands on real results instead of an
  // empty list, and both workspaces tell the same story.
  { id: '25', name: 'Marcus Chen', email: 'marcus.chen@outlook.com', job: 'DevOps Engineer', company: 'Stark Industries', recruiter: 'Olivia Bennett', status: 'new', appliedAt: daysAgo(0), location: 'San Francisco, CA', experience: '6 years', skills: ['AWS', 'Kubernetes', 'CI/CD'], phone: '+1 (415) 555-0164', resume: 'Resume.pdf' },
  { id: '26', name: 'Priya Sharma', email: 'priya.sharma@gmail.com', job: 'QA Engineer', company: 'Umbrella Corp.', recruiter: 'Sofia Marchetti', status: 'new', appliedAt: daysAgo(1), location: 'Chicago, IL', experience: '3 years', skills: ['Selenium', 'Cypress', 'Test Planning'], phone: '+1 (312) 555-0158', resume: 'Resume.pdf' },
  { id: '27', name: 'David Okafor', email: 'david.okafor@yahoo.com', job: 'Business Analyst', company: 'LexCorp', recruiter: 'Marcus Webb', status: 'shortlisted', appliedAt: daysAgo(2), location: 'Seattle, WA', experience: '7 years', skills: ['SQL', 'Requirements', 'Process Mapping'], phone: '+1 (206) 555-0183', resume: 'Resume.pdf' },
  { id: '28', name: 'Marcus Chen', email: 'marcus.chen@outlook.com', job: 'Backend Engineer', company: 'Aperture Science', recruiter: 'Priya Raman', status: 'reviewing', appliedAt: daysAgo(3), location: 'San Francisco, CA', experience: '5 years', skills: ['Node.js', 'PostgreSQL', 'Docker'], phone: '+1 (415) 555-0164', resume: 'Resume.pdf' },
  { id: '29', name: 'David Okafor', email: 'david.okafor@yahoo.com', job: 'Data Analyst', company: 'Aperture Science', recruiter: 'Priya Raman', status: 'hired', appliedAt: daysAgo(4), location: 'Seattle, WA', experience: '8 years', skills: ['SQL', 'Python', 'Tableau'], phone: '+1 (206) 555-0183', resume: 'Resume.pdf' },
  { id: '30', name: 'Priya Sharma', email: 'priya.sharma@gmail.com', job: 'Customer Success Manager', company: 'Stark Industries', recruiter: 'Olivia Bennett', status: 'reviewing', appliedAt: daysAgo(5), location: 'Chicago, IL', experience: '4 years', skills: ['Onboarding', 'Retention', 'CRM'], phone: '+1 (312) 555-0158', resume: 'Resume.pdf' },
  { id: '31', name: 'Sofia Ramirez', email: 'sofia.ramirez@gmail.com', job: 'Marketing Manager', company: 'OmniCorp', recruiter: 'Elena Petrova', status: 'rejected', appliedAt: daysAgo(6), location: 'Austin, TX', experience: '3 years', skills: ['SEO', 'Content Strategy', 'Analytics'], phone: '+1 (512) 555-0127', resume: 'Resume.pdf' },
  { id: '32', name: 'Priya Sharma', email: 'priya.sharma@gmail.com', job: 'Product Designer', company: 'OmniCorp', recruiter: 'Elena Petrova', status: 'rejected', appliedAt: daysAgo(8), location: 'Chicago, IL', experience: '2 years', skills: ['Figma', 'Prototyping', 'UX Research'], phone: '+1 (312) 555-0158', resume: 'Resume.pdf' },
];

const formatAppliedDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getPageItems = (page, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(totalPages - 1, page + 1);
  if (lo > 2) items.push('…');
  for (let p = lo; p <= hi; p += 1) items.push(p);
  if (hi < totalPages - 1) items.push('…');
  items.push(totalPages);
  return items;
};

/**
 * AdminApplicationsPage - the /admin/applications workspace.
 *
 * Lists applicant applications (search + status/job/recruiter/date filters,
 * selected-row state, row action menu, pagination) beside a fixed-width
 * right-side detail panel for the selected application. Data is local UI mock
 * data until the admin applications API supports the fields and filters this
 * workspace needs.
 */
export default function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState(MOCK_APPLICATIONS);
  // Seeded from ?search= so another Admin workspace can deep-link a person's
  // applications (the Jobseekers panel's "View Applications"). The existing
  // search already matches applicant name and email, and the param stays in
  // the URL so a refresh or Back/Forward step keeps the same applicant.
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [status, setStatus] = useState('all');
  const [job, setJob] = useState('all');
  const [recruiter, setRecruiter] = useState('all');
  const [dateRange, setDateRange] = useState('');

  // The current page lives in the URL (?page=N) so a browser refresh or a
  // Back/Forward step restores the exact page instead of falling back to 1.
  // Anything but a positive whole number is treated as page 1.
  const pageParam = Number.parseInt(searchParams.get('page') || '', 10);
  const pageInvalid = !(Number.isInteger(pageParam) && pageParam > 0);
  const page = pageInvalid ? 1 : pageParam;

  const goToPage = useCallback(
    (next, { replace = false } = {}) => {
      const clamped = Math.max(1, Number.isInteger(next) ? next : 1);
      const params = new URLSearchParams(searchParams);
      if (clamped <= 1) params.delete('page');
      else params.set('page', String(clamped));
      if (params.toString() === searchParams.toString()) return;
      setSearchParams(params, { replace });
    },
    [searchParams, setSearchParams]
  );

  const [selectedId, setSelectedId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Any filter or search change jumps back to page 1 and clears the selection
  // so it never points at a row that left the visible page. Only reacts to an
  // actual filter change, so a refresh with ?page=N never drops the param.
  const prevFiltersRef = useRef(`${searchInput}|${status}|${job}|${recruiter}|${dateRange}`);
  useEffect(() => {
    const filtersKey = `${searchInput}|${status}|${job}|${recruiter}|${dateRange}`;
    if (filtersKey === prevFiltersRef.current) return;
    prevFiltersRef.current = filtersKey;
    setSelectedId(null);
    if (searchParams.has('page')) {
      const params = new URLSearchParams(searchParams);
      params.delete('page');
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, status, job, recruiter, dateRange]);

  const uniqueJobs = useMemo(
    () => [...new Set(applications.map((app) => app.job))].sort(),
    [applications]
  );
  const uniqueRecruiters = useMemo(
    () => [...new Set(applications.map((app) => app.recruiter))].sort(),
    [applications]
  );

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return applications.filter((app) => {
      if (status !== 'all' && app.status !== status) return false;
      if (job !== 'all' && app.job !== job) return false;
      if (recruiter !== 'all' && app.recruiter !== recruiter) return false;
      if (dateRange) {
        const cutoff = new Date();
        if (dateRange === 'today') {
          cutoff.setHours(0, 0, 0, 0);
        } else {
          cutoff.setDate(cutoff.getDate() - Number(dateRange));
        }
        if (new Date(app.appliedAt) < cutoff) return false;
      }
      if (q) {
        const haystack = `${app.name} ${app.email} ${app.job} ${app.company} ${app.recruiter}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [applications, searchInput, status, job, recruiter, dateRange]);

  const filtersActive = searchInput !== '' || status !== 'all' || job !== 'all' || recruiter !== 'all' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setStatus('all');
    setJob('all');
    setRecruiter('all');
    setDateRange('');
  }, []);

  const selectApplication = useCallback((id) => {
    setSelectedId(id);
    setActiveMenuId(null);
  }, []);

  const changeStatus = useCallback(
    (id, nextStatus) => {
      setActiveMenuId(null);
      setApplications((prev) =>
        prev.map((app) => (app.id === id ? { ...app, status: nextStatus } : app))
      );
      const app = applications.find((a) => a.id === id);
      if (app) {
        showToast(`“${app.name}” moved to ${STATUS_META[nextStatus].label.toLowerCase()} status`);
      }
    },
    [applications, showToast]
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const listStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(safePage * PAGE_SIZE, total);

  // An invalid or out-of-range ?page=N (e.g. after a refresh with stale data)
  // is repaired to a valid page instead of silently showing an empty one.
  useEffect(() => {
    if (pageInvalid) goToPage(1, { replace: true });
    else if (page > totalPages) goToPage(totalPages, { replace: true });
  }, [page, pageInvalid, totalPages, goToPage]);

  // Read the selection straight from the live list so a status change lands in
  // both the table row and the detail panel on the same render.
  const selected =
    applications.find((app) => String(app.id) === String(selectedId)) || null;

  return (
    <div className="admin-page admin-applications">
      <section className="admin-applications-card" aria-label="Applications list">
        <div className="admin-applications-toolbar">
          <div className="admin-applications-search">
            <span className="admin-applications-search-icon" aria-hidden="true">{SEARCH_ICON}</span>
            <input
              type="text"
              id="admin-applications-search"
              name="search"
              className="admin-applications-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search applicants, jobs, or companies..."
              aria-label="Search applications"
            />
            {searchInput && (
              <button
                type="button"
                className="admin-applications-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                {X_ICON}
              </button>
            )}
          </div>

          <div className="admin-applications-filter">
            <Select
              id="admin-applications-status"
              name="status"
              className="admin-applications-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status"
              options={[
                { value: 'all', label: 'All statuses' },
                ...STATUS_OPTIONS.map((value) => ({ value, label: STATUS_META[value].label })),
              ]}
            />
          </div>
          <div className="admin-applications-filter">
            <Select
              id="admin-applications-job"
              name="job"
              className="admin-applications-filter-select"
              value={job}
              onChange={(e) => setJob(e.target.value)}
              aria-label="Job"
              options={[{ value: 'all', label: 'All jobs' }, ...uniqueJobs.map((title) => ({ value: title, label: title }))]}
            />
          </div>
          <div className="admin-applications-filter">
            <Select
              id="admin-applications-recruiter"
              name="recruiter"
              className="admin-applications-filter-select"
              value={recruiter}
              onChange={(e) => setRecruiter(e.target.value)}
              aria-label="Recruiter"
              options={[{ value: 'all', label: 'All recruiters' }, ...uniqueRecruiters.map((name) => ({ value: name, label: name }))]}
            />
          </div>
          <div className="admin-applications-filter">
            <Select
              id="admin-applications-date"
              name="dateRange"
              className="admin-applications-filter-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Date"
              options={DATE_OPTIONS}
            />
          </div>

          {filtersActive && (
            <button type="button" className="admin-applications-clear" onClick={clearFilters}>
              {X_ICON}
              Clear Filters
            </button>
          )}
        </div>

        <div className="admin-applications-table-scroll">
          <table className="admin-applications-table">
            <colgroup>
              <col className="admin-applications-col-applicant" />
              <col className="admin-applications-col-job" />
              <col className="admin-applications-col-company" />
              <col className="admin-applications-col-status" />
              <col className="admin-applications-col-applied" />
              <col className="admin-applications-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-applications-col-applicant">Applicant</th>
                <th className="admin-applications-col-job">Job</th>
                <th className="admin-applications-col-company">Company</th>
                <th className="admin-applications-col-status">Status</th>
                <th className="admin-applications-col-applied">Applied</th>
                <th className="admin-applications-col-actions">
                  <span className="admin-applications-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-applications-state">
                    <span className="admin-applications-state-title">No applications found</span>
                    <span className="admin-applications-state-text">
                      Try adjusting your search or filters.
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-applications-btn" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((app) => {
                  const meta = STATUS_META[app.status] || STATUS_META.new;
                  const isSelected = String(app.id) === String(selectedId);
                  return (
                    <tr
                      key={app.id}
                      className={`admin-applications-row${isSelected ? ' admin-applications-row--selected' : ''}`}
                      onClick={() => selectApplication(app.id)}
                    >
                      <td className="admin-applications-col-applicant">
                        <span className="admin-applications-applicant">
                          <Avatar
                            src={null}
                            fallbackSrc={avatarFallback(app.name, app.email)}
                            imgClassName="admin-applications-avatar"
                            placeholderClassName="admin-applications-avatar admin-applications-avatar--initials"
                            imgAlt=""
                            iconSize={14}
                          />
                          <span className="admin-applications-applicant-text">
                            <span className="admin-applications-applicant-name">{app.name}</span>
                            <span className="admin-applications-applicant-email">{app.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="admin-applications-col-job">
                        <span className="admin-applications-job">{app.job}</span>
                      </td>
                      <td className="admin-applications-col-company">
                        <span className="admin-applications-company">{app.company}</span>
                      </td>
                      <td className="admin-applications-col-status">
                        <span className={`admin-applications-badge admin-applications-badge--${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="admin-applications-col-applied">
                        <span className="admin-applications-date">{formatAppliedDate(app.appliedAt)}</span>
                      </td>
                      <td className="admin-applications-col-actions" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          app={app}
                          open={activeMenuId === String(app.id)}
                          onToggle={() =>
                            setActiveMenuId((prev) =>
                              prev === String(app.id) ? null : String(app.id)
                            )
                          }
                          onClose={() => setActiveMenuId(null)}
                          onSelect={selectApplication}
                          onChangeStatus={changeStatus}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-applications-footer">
          <p className="admin-applications-footer-count">
            Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> applications
          </p>
          {totalPages > 1 && (
            <nav className="admin-applications-pagination" aria-label="Applications pagination">
              <button
                type="button"
                className="admin-applications-page-btn admin-applications-page-btn--nav"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={safePage <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(safePage, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-applications-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-applications-page-btn${item === safePage ? ' admin-applications-page-btn--current' : ''}`}
                    onClick={() => goToPage(item)}
                    aria-label={`Go to page ${item}`}
                    aria-current={item === safePage ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                className="admin-applications-page-btn admin-applications-page-btn--nav"
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={safePage >= totalPages}
              >
                Next
                {ARROW_RIGHT}
              </button>
            </nav>
          )}
        </footer>
      </section>

      <aside className="admin-applications-panel" aria-label="Application details">
        {selected ? (
          <DetailPanel
            app={selected}
            onClose={() => setSelectedId(null)}
            notify={showToast}
          />
        ) : (
          <div className="admin-applications-panel-state">
            <span className="admin-applications-state-title">Select an application</span>
            <span className="admin-applications-state-text">
              Choose an application from the list to view its details here.
            </span>
          </div>
        )}
      </aside>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row action menu - compact three-dot menu with the same interaction        */
/* language as Admin Jobs: portaled to <body>, anchored near the trigger,    */
/* closed on outside click / Escape / scroll / resize.                       */
/* ------------------------------------------------------------------------ */

function RowActions({ app, open, onToggle, onClose, onSelect, onChangeStatus }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [statusView, setStatusView] = useState(false);

  useEffect(() => {
    if (!open) setStatusView(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      const inMenu = menuRef.current?.contains(e.target);
      const inTrigger = triggerRef.current?.contains(e.target);
      if (!inMenu && !inTrigger) onClose();
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchorEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!anchorEl || !menuEl) return;

    const measure = () => {
      const a = anchorEl.getBoundingClientRect();
      const m = menuEl.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - a.bottom;
      const spaceAbove = a.top;
      const openBelow = spaceBelow >= m.height + gap || spaceBelow >= spaceAbove;
      const top = openBelow ? a.bottom + gap : Math.max(gap, a.top - m.height - gap);
      const menuW = m.width || a.width;
      let left = a.left;
      if (left + menuW > window.innerWidth - gap) left = window.innerWidth - menuW - gap;
      if (left < gap) left = gap;
      setPos({ top, left });
    };

    measure();
    const closeOnScroll = () => onClose();
    window.addEventListener('resize', closeOnScroll);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      window.removeEventListener('resize', closeOnScroll);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`admin-applications-menu-btn${open ? ' admin-applications-menu-btn--open' : ''}`}
        onClick={onToggle}
        aria-label={`Actions for ${app.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {MORE_ICON}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="admin-applications-menu"
            role="menu"
            aria-label={`Actions for ${app.name}`}
            style={{
              ...(pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }),
              minWidth: 196,
            }}
          >
            {statusView ? (
              <>
                <div className="admin-applications-menu-head">
                  <button
                    type="button"
                    className="admin-applications-menu-subhead"
                    onClick={() => setStatusView(false)}
                    aria-label="Back"
                  >
                    {ARROW_LEFT}
                  </button>
                  <span className="admin-applications-menu-label">Change status</span>
                </div>
                <div className="admin-applications-menu-divider" />
                {STATUS_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={app.status === value}
                    className={`admin-applications-menu-item${
                      app.status === value ? ' admin-applications-menu-item--selected' : ''
                    }`}
                    onClick={() => onChangeStatus(app.id, value)}
                  >
                    <span className="admin-applications-menu-check">
                      {app.status === value ? CHECK_ICON : null}
                    </span>
                    <span className="admin-applications-menu-item-label">{STATUS_META[value].label}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-applications-menu-item"
                  onClick={() => setStatusView(true)}
                >
                  <span className="admin-applications-menu-check" />
                  <span className="admin-applications-menu-item-label">Change status</span>
                  <span className="admin-applications-menu-chevron" aria-hidden="true">{ARROW_RIGHT}</span>
                </button>
                <a
                  className="admin-applications-menu-item admin-applications-menu-item--link"
                  href={`mailto:${app.email}`}
                >
                  <span className="admin-applications-menu-check" />
                  <span className="admin-applications-menu-item-label">Contact applicant</span>
                </a>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Right-side detail panel - contextual inspector for the selected row.      */
/* All data is local mock data, so View Profile / View Resume only surface   */
/* feedback through the existing Toast instead of navigating anywhere.       */
/* ------------------------------------------------------------------------ */

function DetailPanel({ app, onClose, notify }) {
  return (
    <div className="admin-applications-detail">
      <header className="admin-applications-detail-head">
        <Avatar
          src={null}
          fallbackSrc={avatarFallback(app.name, app.email)}
          imgClassName="admin-applications-avatar admin-applications-detail-avatar"
          placeholderClassName="admin-applications-avatar admin-applications-avatar--initials admin-applications-detail-avatar"
          imgAlt=""
          iconSize={16}
        />
        <div className="admin-applications-detail-titles">
          <h2 className="admin-applications-detail-name">{app.name}</h2>
          <p className="admin-applications-detail-email">{app.email}</p>
          <p className="admin-applications-detail-location">{app.location}</p>
        </div>
        <div className="admin-applications-detail-head-side">
          <button
            type="button"
            className="admin-applications-detail-close"
            onClick={onClose}
            aria-label="Close application details"
          >
            {X_ICON}
          </button>
        </div>
      </header>

      <section className="admin-applications-detail-section">
        <h3 className="admin-applications-detail-sub">Application</h3>
        <dl className="admin-applications-detail-list">
          <div className="admin-applications-detail-row">
            <dt>Job title</dt>
            <dd>{app.job}</dd>
          </div>
          <div className="admin-applications-detail-row">
            <dt>Company</dt>
            <dd>{app.company}</dd>
          </div>
          <div className="admin-applications-detail-row">
            <dt>Applied</dt>
            <dd>{formatAppliedDate(app.appliedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-applications-detail-section">
        <h3 className="admin-applications-detail-sub">Candidate</h3>
        <dl className="admin-applications-detail-list">
          <div className="admin-applications-detail-row">
            <dt>Location</dt>
            <dd>{app.location}</dd>
          </div>
          <div className="admin-applications-detail-row">
            <dt>Experience</dt>
            <dd>{app.experience}</dd>
          </div>
          <div className="admin-applications-detail-row">
            <dt>Skills</dt>
            <dd>
              <span className="admin-applications-detail-skills">
                {app.skills.map((skill) => (
                  <span key={skill} className="admin-applications-detail-skill">
                    {skill}
                  </span>
                ))}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="admin-applications-detail-section">
        <h3 className="admin-applications-detail-sub">Resume</h3>
        <div className="admin-applications-detail-resume">
          <span className="admin-applications-detail-resume-icon" aria-hidden="true">
            {DOC_ICON}
          </span>
          <div className="admin-applications-detail-resume-info">
            <span className="admin-applications-detail-resume-name">{app.resume}</span>
            <span className="admin-applications-detail-resume-actions">
              <button type="button" onClick={() => notify('Resume access is not available in this preview.')}>
                View
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => notify('Resume access is not available in this preview.')}>
                Download
              </button>
            </span>
          </div>
        </div>
      </section>

      <section className="admin-applications-detail-section">
        <h3 className="admin-applications-detail-sub">Contact</h3>
        <dl className="admin-applications-detail-list">
          <div className="admin-applications-detail-row">
            <dt>Email</dt>
            <dd>{app.email}</dd>
          </div>
          <div className="admin-applications-detail-row">
            <dt>Phone</dt>
            <dd>{app.phone}</dd>
          </div>
        </dl>
      </section>

      <footer className="admin-applications-detail-actions">
        <div className="admin-applications-detail-actions-row">
          <button
            type="button"
            className="admin-applications-btn"
            onClick={() => notify('Applicant profiles are not available in this preview.')}
          >
            View Profile
          </button>
          <button
            type="button"
            className="admin-applications-btn"
            onClick={() => notify('Resume access is not available in this preview.')}
          >
            View Resume
          </button>
        </div>
      </footer>
    </div>
  );
}
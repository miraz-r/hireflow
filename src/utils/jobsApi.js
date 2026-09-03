import api from './api';
import { jobs as mockJobs } from '../data/mockData';

// Normalize an API job doc into the shape the UI expects.
// - id: `_id` string
// - postedAt: human-readable relative string derived from createdAt
const normalizeJob = (job) => {
  const id = job._id ?? job.id;
  let postedAt = job.postedAt;
  if (!postedAt && job.createdAt) {
    postedAt = timeAgo(job.createdAt);
  }
  if (!postedAt) {
    postedAt = 'Recently';
  }
  return { ...job, id, postedAt };
};

const timeAgo = (dateStr) => {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 'Recently';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
};

/**
 * Fetch jobs from the backend. Falls back to the local mock data if the API
 * is unreachable (e.g. backend not running), so the UI still works.
 *
 * @returns {Promise<Array>} normalized job objects
 */
export async function fetchJobs() {
  try {
    const res = await api.get('/jobs', {
      params: { limit: 100 },
      timeout: 4000,
    });
    const rawJobs = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
    if (rawJobs.length > 0) {
      return rawJobs.map(normalizeJob);
    }
    // API reachable but empty — fall back to mock so the page isn't blank.
    return mockJobs;
  } catch {
    // Backend down — use the built-in mock catalogue.
    return mockJobs;
  }
}

/**
 * Fetch a single job by id from the backend. Falls back to the local mock
 * catalogue if the API is unreachable or the job isn't found there.
 *
 * @param {string} id
 * @returns {Promise<object>} normalized job object
 */
export async function fetchJobById(id) {
  try {
    const res = await api.get(`/jobs/${id}`, { timeout: 4000 });
    const job = res.data?.job ?? res.data;
    if (job) return normalizeJob(job);
  } catch {
    // fall through to mock
  }
  const mock = mockJobs.find((j) => String(j.id) === String(id));
  return mock ? { ...mock } : null;
}

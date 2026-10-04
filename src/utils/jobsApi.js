import api from './api';

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
 * Fetch jobs from the backend.
 *
 * Only real API data is ever returned. An empty catalogue and an unreachable
 * API both resolve to `[]` so the caller renders its own empty state, rather
 * than substituting placeholder listings a visitor could try to apply to.
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
    return rawJobs.map(normalizeJob);
  } catch {
    return [];
  }
}

/**
 * Fetch a single job by id from the backend.
 *
 * Resolves to `null` when the API has no such job (404) or cannot be reached,
 * so the caller shows its not-found state instead of rendering a placeholder
 * job that does not exist.
 *
 * @param {string} id
 * @returns {Promise<object|null>} normalized job object, or null
 */
export async function fetchJobById(id) {
  try {
    const res = await api.get(`/jobs/${id}`, { timeout: 4000 });
    const job = res.data?.job ?? res.data;
    return job ? normalizeJob(job) : null;
  } catch {
    return null;
  }
}

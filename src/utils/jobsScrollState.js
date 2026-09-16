// Session-scoped bookmark of the Jobs page scroll position, keyed to the exact
// React Router history entry (`location.key`) the job list was rendered on.
// Stored in sessionStorage so it survives a refresh of the Job Detail page:
// the browser persists each history entry's key in window.history.state across
// reloads, so a restored `/` entry still yields the same key.

const STORAGE_KEY = 'hireflow-jobs-scroll';

export function saveJobsScroll(bookmark) {
  if (
    !bookmark ||
    typeof bookmark.jobsLocationKey !== 'string' ||
    typeof bookmark.scrollY !== 'number'
  ) {
    clearJobsScroll();
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bookmark));
  } catch (e) {
    // sessionStorage unavailable - treat as no bookmark
  }
}

export function getJobsScroll() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.jobsLocationKey === 'string' &&
      typeof parsed.scrollY === 'number'
    ) {
      return parsed;
    }
  } catch (e) {
    // ignore malformed bookmark
  }
  return null;
}

export function clearJobsScroll() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}
// Single home for media URLs used across the HireFlow frontend:
// the local upload base, uploaded-file resolution, and the online
// image/logo services used as fallbacks when no real image exists.

// Base URL of the API server that serves uploaded avatars/resumes.
export const MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE || 'http://localhost:5000';

// Uploaded files (avatars, resumes) are relative paths served by the API server.
export const resolveMediaUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}${url}`;
};

// Curated portrait for each person in the demo/mock data, keyed by their
// full name (never email) so the same person always shows the same face,
// even where a mock list uses a different email address for them. Portraits
// are real, gender-correct photos; unknown people fall back to the neutral
// silhouette icon instead of a guessed face.
const DEMO_PORTRAITS = {
  'aisha khan': 'https://randomuser.me/api/portraits/women/68.jpg',
  'adrian foster': 'https://randomuser.me/api/portraits/men/41.jpg',
  'ava williams': 'https://randomuser.me/api/portraits/women/63.jpg',
  'daniel lopez': 'https://randomuser.me/api/portraits/men/36.jpg',
  'daniel morgan': 'https://randomuser.me/api/portraits/men/12.jpg',
  'david okafor': 'https://randomuser.me/api/portraits/men/99.jpg',
  'emily davis': 'https://randomuser.me/api/portraits/women/44.jpg',
  'emily tran': 'https://randomuser.me/api/portraits/women/3.jpg',
  'ethan brooks': 'https://randomuser.me/api/portraits/men/33.jpg',
  'fatima noor': 'https://randomuser.me/api/portraits/women/90.jpg',
  'grace liu': 'https://randomuser.me/api/portraits/women/24.jpg',
  'hannah kim': 'https://randomuser.me/api/portraits/women/47.jpg',
  'isabella rossi': 'https://randomuser.me/api/portraits/women/86.jpg',
  'james rodriguez': 'https://randomuser.me/api/portraits/men/32.jpg',
  'jane doe': 'https://randomuser.me/api/portraits/women/58.jpg',
  'jordan fields': 'https://randomuser.me/api/portraits/men/67.jpg',
  'leo garcia': 'https://randomuser.me/api/portraits/men/18.jpg',
  'lucas braun': 'https://randomuser.me/api/portraits/men/70.jpg',
  'lucas meyer': 'https://randomuser.me/api/portraits/men/57.jpg',
  'marcus chen': 'https://randomuser.me/api/portraits/men/64.jpg',
  'marcus hill': 'https://randomuser.me/api/portraits/men/95.jpg',
  'marcus lee': 'https://randomuser.me/api/portraits/men/26.jpg',
  'maya singh': 'https://randomuser.me/api/portraits/women/29.jpg',
  'mia kowalski': 'https://randomuser.me/api/portraits/women/52.jpg',
  'michael chen': 'https://randomuser.me/api/portraits/men/75.jpg',
  'natalia reyes': 'https://randomuser.me/api/portraits/women/79.jpg',
  'nina petrova': 'https://randomuser.me/api/portraits/women/37.jpg',
  'noah patel': 'https://randomuser.me/api/portraits/men/44.jpg',
  'nora silva': 'https://randomuser.me/api/portraits/women/25.jpg',
  'oliver bennett': 'https://randomuser.me/api/portraits/men/90.jpg',
  'oliver smith': 'https://randomuser.me/api/portraits/men/85.jpg',
  'priya patel': 'https://randomuser.me/api/portraits/women/1.jpg',
  'priya sharma': 'https://randomuser.me/api/portraits/women/21.jpg',
  'ryan o connor': 'https://randomuser.me/api/portraits/men/22.jpg',
  'sarah johnson': 'https://randomuser.me/api/portraits/women/65.jpg',
  'sofia ramirez': 'https://randomuser.me/api/portraits/women/17.jpg',
  'sophia carter': 'https://randomuser.me/api/portraits/women/32.jpg',
  'tom becker': 'https://randomuser.me/api/portraits/men/15.jpg',
  'victor almeida': 'https://randomuser.me/api/portraits/men/51.jpg',
  'zoe carter': 'https://randomuser.me/api/portraits/women/75.jpg',
  'zoe chen': 'https://randomuser.me/api/portraits/women/13.jpg',
};

const normalizePersonName = (name) =>
  (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Fallback portrait for a person with no uploaded photo. Identity is the full
// name, so a person keeps one face everywhere; the second argument (email) is
// kept for compatibility with existing callers but the image never depends on
// it. Unknown people return null so Avatar shows the default silhouette.
export const avatarFallback = (name, email) => {
  void email;
  return DEMO_PORTRAITS[normalizePersonName(name)] || null;
};

// Clearbit Logo API: official brand mark keyed by company domain.
export const companyLogo = (domain) =>
  domain ? `https://logo.clearbit.com/${encodeURIComponent(domain)}` : null;

// DuckDuckGo favicon service: domain-icon fallback when Clearbit has no logo.
export const ddgCompanyLogo = (domain) =>
  domain ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico` : null;
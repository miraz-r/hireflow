// Minimal fixed-window in-memory rate limiter for authentication-sensitive
// endpoints. Deliberately small and dependency-free: this backend is a
// single-process demo deployment, so an in-process counter is sufficient.
// Not a substitute for a distributed/backing-store limiter in a multi-instance
// deployment.
//
// Window semantics: each identity starts a fresh window on its first request.
// Once the window expires the next request opens a new window and is allowed.
// When `max` is exceeded within a window the request is rejected with 429 and
// a Retry-After header (seconds remaining in the window).
//
// Limits are chosen to be generous enough for normal demo/development use
// while still stopping scripted abuse:
//   - login: 20 attempts / 15 min / IP — blocks credential-stuffing loops
//     without tripping a single developer or tester.
//   - register: 10 attempts / 60 min / IP — caps account-creation spam while
//     leaving plenty of headroom for legit signups.
//   - email-change initiation / resend: 5 per 60 min / user — each call sends
//     an outbound email, so this caps per-account email spam.
//   - email-change verification: 10 per 15 min / user — generous for retrying
//     a pasted token while blocking scripted guesses.

const createRateLimiter = ({
  windowMs,
  max,
  keyGenerator = (req) => req.ip,
  message = 'Too many requests, please try again later',
}) => {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new TypeError('rateLimiter: windowMs must be a positive number');
  }
  if (!Number.isInteger(max) || max <= 0) {
    throw new TypeError('rateLimiter: max must be a positive integer');
  }

  // key -> { start, count }
  const hits = new Map();
  const MAX_STORED_KEYS = 10000;

  return (req, res, next) => {
    const now = Date.now();

    // Bounded memory: once the map grows large, drop every entry whose window
    // already expired. Each active key only ever holds a single entry.
    if (hits.size >= MAX_STORED_KEYS) {
      for (const [key, entry] of hits) {
        if (now - entry.start >= windowMs) hits.delete(key);
      }
    }

    const key = keyGenerator(req);
    const entry = hits.get(key);

    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(
        1,
        Math.ceil((entry.start + windowMs - now) / 1000)
      );
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }

    return next();
  };
};

module.exports = { createRateLimiter };
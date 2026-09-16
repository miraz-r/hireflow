import { apiGet, apiPost, apiDelete } from './api';

// Narrowly-scoped helpers for the email-change flow. All requests go through
// the shared axios instance in `./api` (JWT injection + error normalization),
// so components never touch raw fetch() or auth headers directly.

/** Start a pending email change for `newEmail` (current email stays untouched). */
export const requestEmailChange = (newEmail) =>
  apiPost('/email-change', { newEmail });

/** Confirm a pending email change with the single-use verification token. */
export const verifyEmailChange = (token) =>
  apiPost('/email-change/verify-email', { token });

/** Resend the verification email for the current pending change. */
export const resendEmailChange = () => apiPost('/email-change/resend');

/** Cancel the current pending email change (current email stays untouched). */
export const cancelEmailChange = () => apiDelete('/email-change');

/**
 * Fetch whether the current user has a pending email change.
 * @returns {Promise<{pending: boolean, newEmail?: string, expiresAt?: string}>}
 */
export const getPendingEmailChange = () => apiGet('/email-change');
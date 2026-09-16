const env = require('../config/env');

const EMAIL_FROM = env.emailFrom || 'HireFlow <onboarding@resend.dev>';

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch]
  );

const wrap = (subject, bodyHtml) =>
  `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#f5f5f5">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(subject)}</h1>
      ${bodyHtml}
      <p style="margin-top:24px;color:#777;font-size:12px">HireFlow &mdash; email security</p>
    </div>
  </body>
</html>`;

const sendEmail = async ({ to, subject, html }) => {
  if (!env.resendApiKey) {
    // Graceful degradation: never hardcode or fall back to fake delivery.
    console.warn(
      `[email] RESEND_API_KEY not configured; skipping "${subject}" email to ${to}`
    );
    return { skipped: true };
  }

  const { Resend } = require('resend');
  const resend = new Resend(env.resendApiKey);

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return { id: data && data.id };
};

/**
 * Sends the single-use verification token to the NEW email address.
 * The token only ever appears in this email (and the caller's memory) — it is
 * never logged and never persisted in raw form.
 */
const sendEmailChangeVerification = async ({ to, token }) => {
  const verifyUrl = `${env.clientOrigin}/verify-email?token=${encodeURIComponent(token)}`;
  const body = `
    <p>You requested to change the email address on your HireFlow account to:</p>
    <p><strong>${escapeHtml(to)}</strong></p>
    <p>To confirm the change, open the link below. It is valid for 1 hour.</p>
    <p style="text-align:center">
      <a href="${verifyUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Verify new email</a>
    </p>
    <p>If the button does not work, paste this code when asked for a verification code:</p>
    <p><code style="font-size:16px;word-break:break-all">${escapeHtml(token)}</code></p>
    <p>If you did not request this change, ignore this email. Your email address will not change.</p>`;

  return sendEmail({
    to,
    subject: 'Verify your new email address',
    html: wrap('Verify your new email address', body),
  });
};

/** Notifies the OLD address that the account email was successfully changed. */
const sendEmailChangedNotification = async ({ to, newEmail }) => {
  const body = `
    <p>Your HireFlow account email address was successfully changed.</p>
    <p>From now on you will sign in with <strong>${escapeHtml(newEmail)}</strong>.</p>
    <p>If you did not make this change, please contact support immediately.</p>`;

  return sendEmail({
    to,
    subject: 'Your email address has been changed',
    html: wrap('Your email address has been changed', body),
  });
};

module.exports = {
  sendEmailChangeVerification,
  sendEmailChangedNotification,
};
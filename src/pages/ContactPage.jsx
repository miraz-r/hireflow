import { useState, useCallback } from 'react';
import Reveal from '../components/Reveal';
import Select from '../components/ui/Select';
import './ContactPage.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBJECTS = [
  { value: '', label: 'Select a subject' },
  { value: 'general', label: 'General inquiry' },
  { value: 'support', label: 'Technical support' },
  { value: 'billing', label: 'Billing & subscriptions' },
  { value: 'press', label: 'Press & media' },
  { value: 'partnership', label: 'Partnerships' },
  { value: 'other', label: 'Other' },
];

function validateForm({ fullName, email, subject, message }) {
  const errors = {};
  const name = fullName.trim();
  if (!name) {
    errors.fullName = 'Full name is required.';
  } else if (name.length > 120) {
    errors.fullName = 'Full name must be 1-120 characters.';
  }
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!subject) {
    errors.subject = 'Please select a subject.';
  }
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    errors.message = 'Message is required.';
  } else if (trimmedMessage.length < 20) {
    errors.message = 'Message must be at least 20 characters.';
  } else if (trimmedMessage.length > 5000) {
    errors.message = 'Message must be 5000 characters or fewer.';
  }
  return errors;
}

function focusFirstError(errors, fieldIds) {
  const first = fieldIds.find(([name]) => Boolean(errors[name]));
  if (!first) return;
  const el = document.getElementById(first[1]);
  if (el) el.focus();
}

const CONTACT_FIELD_IDS = [
  ['fullName', 'contact-name'],
  ['email', 'contact-email'],
  ['subject', 'contact-subject'],
  ['message', 'contact-message'],
];

export default function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState('idle'); // idle | error | success
  const [formError, setFormError] = useState('');

  const handleFullNameChange = (e) => {
    setFullName(e.target.value);
    if (fieldErrors.fullName) {
      setFieldErrors((prev) => ({ ...prev, fullName: '' }));
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handleSubjectChange = (e) => {
    setSubject(e.target.value);
    if (fieldErrors.subject) {
      setFieldErrors((prev) => ({ ...prev, subject: '' }));
    }
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    if (fieldErrors.message) {
      setFieldErrors((prev) => ({ ...prev, message: '' }));
    }
  };

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (submitting) return;

      const errors = validateForm({ fullName, email, subject, message });
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setFormState('error');
        setFormError('Please fix the errors above.');
        focusFirstError(errors, CONTACT_FIELD_IDS);
        return;
      }

      setSubmitting(true);
      setFormState('idle');
      setFormError('');

      setTimeout(() => {
        setSubmitting(false);
        setFormState('success');
        setFullName('');
        setEmail('');
        setSubject('');
        setMessage('');
      }, 600);
    },
    [fullName, email, subject, message, submitting]
  );

  return (
    <div className="contact-page">
      {/* ── HERO ── */}
      <section className="contact-hero">
        <div className="contact-hero-glow" aria-hidden="true" />
        <div className="contact-hero-glow contact-hero-glow--secondary" aria-hidden="true" />
        <div className="container contact-hero-layout">
          <div className="contact-hero-content">
            <h1 className="contact-hero-title">How can we help?</h1>
            <p className="contact-hero-desc">
              Have a question, suggestion, or need help with HireFlow?
              Send us a message and we&apos;ll get back to you.
            </p>
          </div>
        </div>
      </section>

      {/* ── CONTACT FORM ── */}
      <section className="contact-form-section" aria-labelledby="contact-form-heading">
        <div className="container">
          <Reveal>
            <div className="contact-form-wrapper">
              <header className="contact-form-header">
                <h2 id="contact-form-heading" className="contact-form-title">Send us a message</h2>
                <p className="contact-form-subtitle">We&apos;ll respond as soon as we can.</p>
              </header>

              <form className="contact-form" onSubmit={handleSubmit} noValidate>
                {formState === 'error' && (
                  <div className="contact-alert contact-alert-error" role="alert" aria-live="assertive">
                    <svg className="contact-alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                {formState === 'success' && (
                  <div className="contact-alert contact-alert-success" role="status" aria-live="polite">
                    <svg className="contact-alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>Thanks for reaching out. Your message has been received as a demo submission.</span>
                  </div>
                )}

                <div className="contact-field">
                  <label htmlFor="contact-name" className="contact-label">
                    Full name <span className="contact-required" aria-hidden="true">*</span>
                  </label>
                  <div className="contact-input-wrap">
                    <input
                      id="contact-name"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={handleFullNameChange}
                      placeholder="Jane Doe"
                      className={`contact-input${fieldErrors.fullName ? ' input-error' : ''}`}
                      aria-invalid={fieldErrors.fullName ? true : undefined}
                      aria-describedby={fieldErrors.fullName ? 'contact-name-error' : undefined}
                      disabled={submitting}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <span id="contact-name-error" className="contact-field-error" role="alert">
                      {fieldErrors.fullName}
                    </span>
                  )}
                </div>

                <div className="contact-field">
                  <label htmlFor="contact-email" className="contact-label">
                    Email <span className="contact-required" aria-hidden="true">*</span>
                  </label>
                  <div className="contact-input-wrap">
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      value={email}
                      onChange={handleEmailChange}
                      placeholder="you@company.com"
                      className={`contact-input${fieldErrors.email ? ' input-error' : ''}`}
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined}
                      disabled={submitting}
                    />
                  </div>
                  {fieldErrors.email && (
                    <span id="contact-email-error" className="contact-field-error" role="alert">
                      {fieldErrors.email}
                    </span>
                  )}
                </div>

                <div className="contact-field">
                  <label htmlFor="contact-subject" className="contact-label">
                    Subject <span className="contact-required" aria-hidden="true">*</span>
                  </label>
                  <Select
                    id="contact-subject"
                    name="subject"
                    value={subject}
                    onChange={handleSubjectChange}
                    className={`contact-select${fieldErrors.subject ? ' input-error' : ''}`}
                    aria-invalid={fieldErrors.subject ? true : undefined}
                    aria-describedby={fieldErrors.subject ? 'contact-subject-error' : undefined}
                    disabled={submitting}
                    options={SUBJECTS.map((s) => ({ value: s.value, label: s.label }))}
                  />
                  {fieldErrors.subject && (
                    <span id="contact-subject-error" className="contact-field-error" role="alert">
                      {fieldErrors.subject}
                    </span>
                  )}
                </div>

                <div className="contact-field">
                  <label htmlFor="contact-message" className="contact-label">
                    Message <span className="contact-required" aria-hidden="true">*</span>
                  </label>
                  <div className="contact-textarea-wrap">
                    <textarea
                      id="contact-message"
                      name="message"
                      required
                      value={message}
                      onChange={handleMessageChange}
                      placeholder="Tell us how we can help…"
                      rows={6}
                      className={`contact-textarea${fieldErrors.message ? ' input-error' : ''}`}
                      aria-invalid={fieldErrors.message ? true : undefined}
                      aria-describedby={fieldErrors.message ? 'contact-message-error' : (formState === 'success' ? undefined : 'contact-message-hint')}
                      disabled={submitting}
                    />
                    {formState !== 'success' && !fieldErrors.message && (
                      <span id="contact-message-hint" className="contact-field-hint">Minimum 20 characters</span>
                    )}
                  </div>
                  {fieldErrors.message && (
                    <span id="contact-message-error" className="contact-field-error" role="alert">
                      {fieldErrors.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg contact-submit"
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? (
                    <>
                      <svg className="contact-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span>Sending…</span>
                    </>
                  ) : (
                    <span>Send message</span>
                  )}
                </button>
              </form>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
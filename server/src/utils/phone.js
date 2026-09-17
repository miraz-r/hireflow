// Shared phone-format/backstop rule for Profile and Application validation.
// libphonenumber-js remains the registration validity authority; this is the
// format guard applied by Profile/Apply backend validators.
const PHONE_CHARS_RE = /^[+0-9()\-\s]{6,32}$/;

module.exports = {
  PHONE_CHARS_RE,
};
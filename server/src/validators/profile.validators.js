const { body, validationResult } = require('express-validator');

// ---------------------------------------------------------------------------
// Shared field validators — run for every role
// ---------------------------------------------------------------------------
const sharedValidators = [
  body('fullName')
    .optional()
    .isString()
    .withMessage('fullName must be a string')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('fullName must be 1-120 characters'),

  body('phone')
    .optional()
    .isString()
    .withMessage('phone must be a string')
    .trim()
    .matches(/^[+0-9()\-\s]{6,32}$/)
    .withMessage('Invalid phone format'),

  body('location')
    .optional()
    .isString()
    .withMessage('location must be a string')
    .trim()
    .isLength({ max: 160 })
    .withMessage('location cannot exceed 160 characters'),
];

// ---------------------------------------------------------------------------
// Jobseeker-only field validators
// ---------------------------------------------------------------------------
const jobseekerValidators = [
  body('headline')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 140 })
    .withMessage('headline cannot exceed 140 characters'),

  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('bio cannot exceed 2000 characters'),

  body('skills')
    .optional()
    .isArray({ max: 50 })
    .withMessage('skills must be an array of up to 50 strings'),
  body('skills.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Each skill cannot exceed 100 characters'),

  body('education')
    .optional()
    .isArray()
    .withMessage('education must be an array'),
  body('education.*.school')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('education[].school cannot exceed 200 characters'),
  body('education.*.degree')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('education[].degree cannot exceed 120 characters'),
  body('education.*.field')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('education[].field cannot exceed 120 characters'),
  body('education.*.startDate')
    .optional()
    .isISO8601()
    .toDate(),
  body('education.*.endDate')
    .optional()
    .isISO8601()
    .toDate(),
  body('education.*.current')
    .optional()
    .isBoolean()
    .toBoolean(),
  body('education.*.description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('education[].description cannot exceed 1000 characters'),

  body('experience')
    .optional()
    .isArray()
    .withMessage('experience must be an array'),
  body('experience.*.company')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('experience[].company cannot exceed 200 characters'),
  body('experience.*.title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 160 })
    .withMessage('experience[].title cannot exceed 160 characters'),
  body('experience.*.location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 160 })
    .withMessage('experience[].location cannot exceed 160 characters'),
  body('experience.*.startDate')
    .optional()
    .isISO8601()
    .toDate(),
  body('experience.*.endDate')
    .optional()
    .isISO8601()
    .toDate(),
  body('experience.*.current')
    .optional()
    .isBoolean()
    .toBoolean(),
  body('experience.*.description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('experience[].description cannot exceed 2000 characters'),

  body('links')
    .optional()
    .isArray()
    .withMessage('links must be an array'),
  body('links.*.label')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('links[].label cannot exceed 60 characters'),
  body('links.*.url')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('links[].url cannot exceed 500 characters')
    .matches(/^https?:\/\/[^\s]+$/i)
    .withMessage('links[].url must be a valid http(s) URL'),
];

// ---------------------------------------------------------------------------
// Recruiter-only field validators
// ---------------------------------------------------------------------------
const recruiterValidators = [
  body('jobTitle')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 160 })
    .withMessage('jobTitle cannot exceed 160 characters'),

  body('companyName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('companyName cannot exceed 200 characters'),

  body('companyWebsite')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('companyWebsite cannot exceed 500 characters')
    .matches(/^https?:\/\/[^\s]+$/i)
    .withMessage('companyWebsite must be a valid http(s) URL'),

  body('companyDescription')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('companyDescription cannot exceed 2000 characters'),
];

// ---------------------------------------------------------------------------
// Chain builders
// ---------------------------------------------------------------------------

/**
 * Build the validator chain for a given role.
 * sharedValidators run for everyone; role-specific ones run conditionally.
 *
 * @param {'jobseeker' | 'recruiter'} role
 */
const buildRoleChain = (role) => {
  const roleValidators =
    role === 'jobseeker' ? jobseekerValidators : recruiterValidators;
  return [...sharedValidators, ...roleValidators];
};

/** Full chain for POST (create) and PUT (full replace) — requires fullName and phone. */
const createOrReplaceValidators = (role) =>
  buildRoleChain(role).concat([
    body('fullName')
      .exists({ values: 'falsy' })
      .withMessage('fullName is required')
      .isString()
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage('fullName must be 1-120 characters'),
    body('phone')
      .exists({ values: 'falsy' })
      .withMessage('phone is required')
      .isString()
      .trim()
      .matches(/^[+0-9()\-\s]{6,32}$/)
      .withMessage('Invalid phone format'),
    body('location')
      .exists({ values: 'falsy' })
      .withMessage('location is required')
      .isString()
      .trim()
      .isLength({ max: 160 })
      .withMessage('location cannot exceed 160 characters'),
  ]);

/** Chain for PATCH (partial update) — all fields optional, but the profile's
 * required shared details (fullName, phone, location) stay required so a
 * profile is never persisted without them. */
const patchValidators = (role) =>
  buildRoleChain(role).concat([
    body('fullName')
      .exists({ values: 'falsy' })
      .withMessage('fullName is required')
      .isString()
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage('fullName must be 1-120 characters'),
    body('phone')
      .exists({ values: 'falsy' })
      .withMessage('phone is required')
      .isString()
      .trim()
      .matches(/^[+0-9()\-\s]{6,32}$/)
      .withMessage('Invalid phone format'),
    body('location')
      .exists({ values: 'falsy' })
      .withMessage('location is required')
      .isString()
      .trim()
      .isLength({ max: 160 })
      .withMessage('location cannot exceed 160 characters'),
  ]);

/**
 * Middleware-style runner — collects express-validator errors and returns them
 * as a 400 with both a human-readable `error` summary and a structured
 * `fieldErrors` map (`{ field: message }`) so the client can place each error
 * under the relevant form field.
 */
const runValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fieldErrors = {};
    for (const err of errors.array()) {
      if (err.path && !(err.path in fieldErrors)) {
        fieldErrors[err.path] = err.msg;
      }
    }
    return res.status(400).json({
      error: errors.array()[0].msg,
      fieldErrors,
    });
  }
  return next();
};

/**
 * Builds a middleware that, at request time:
 *   1. Reads req.user.role (set by the authenticate middleware that runs first).
 *   2. Selects the appropriate role-aware validator chain.
 *   3. Runs each validator asynchronously via chain.run(req).
 *   4. Calls runValidation once all validators have completed, then next().
 *
 * This exists because the validator chains are factories parameterised by role,
 * but the role lives on req.user and is only available after authenticate runs.
 *
 * @param {'createOrReplace' | 'patch'} kind
 * @returns {(req, res, next) => void}
 */
const buildChain = (kind) => (req, res, next) => {
  const role = req.user && req.user.role;
  if (!role) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const chains =
    kind === 'createOrReplace'
      ? createOrReplaceValidators(role)
      : patchValidators(role);

  if (chains.length === 0) return next();

  let pending = chains.length;

  const checkDone = () => {
    if (pending === 0) runValidation(req, res, next);
  };

  for (const chain of chains) {
    chain
      .run(req)
      .then(() => {
        pending -= 1;
        checkDone();
      })
      .catch(() => {
        // chain.run() should not reject; errors are collected on req
        pending -= 1;
        checkDone();
      });
  }
};

module.exports = {
  sharedValidators,
  jobseekerValidators,
  recruiterValidators,
  createOrReplaceValidators,
  patchValidators,
  runValidation,
  buildChain,
};

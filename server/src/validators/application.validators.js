const { body, param, query, validationResult } = require('express-validator');
const { PHONE_CHARS_RE } = require('../utils/phone');
const { APPLICATION_STATUSES } = require('../utils/applicationStatus');

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

// POST /api/applications — body must carry a valid job id.
const createValidators = [
  body('jobId')
    .isMongoId()
    .withMessage('jobId must be a valid id'),
  body('phone')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ max: 32 })
    .withMessage('Phone must be at most 32 characters')
    .matches(PHONE_CHARS_RE)
    .withMessage('Invalid phone format'),
  body('resumeUrl')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Resume is required')
    .isLength({ max: 500 })
    .withMessage('Resume URL must be at most 500 characters'),
  body('coverLetter')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Cover letter must be at most 5000 characters'),
  body('fullName')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('fullName must be 1-120 characters'),
  body('email')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isEmail()
    .withMessage('Email must be valid')
    .isLength({ max: 254 })
    .withMessage('Email must be at most 254 characters'),
  body('linkedin')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('LinkedIn must be at most 500 characters')
    .matches(/^https?:\/\/.+\..+/i)
    .withMessage('LinkedIn must be a valid URL starting with http:// or https://'),
  body('portfolio')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Portfolio must be at most 500 characters')
    .matches(/^https?:\/\/.+\..+/i)
    .withMessage('Portfolio must be a valid URL starting with http:// or https://'),
  runValidation,
];

// GET /api/applications/:jobId/me — the job id is a URL param.
const jobIdParamValidators = [
  param('jobId')
    .isMongoId()
    .withMessage('Invalid job id'),
  runValidation,
];

// GET /api/applications/:id — the application id is a URL param.
const applicationIdValidators = [
  param('id')
    .isMongoId()
    .withMessage('Invalid application id'),
  runValidation,
];

// PATCH /api/applications/:id/status — the application id is a URL param and
// the status must be one of the existing Application enum values.
const statusUpdateValidators = [
  param('id')
    .isMongoId()
    .withMessage('Invalid application id'),
  body('status')
    .isString()
    .trim()
    .isIn(APPLICATION_STATUSES)
    .withMessage(`Status must be one of: ${APPLICATION_STATUSES.join(', ')}`),
  runValidation,
];

// ---------------------------------------------------------------------------
// GET /api/admin/applications — Admin Applications workspace query filters.
//
// Every filter is optional, and the defaults reproduce the Overview feed
// exactly: no query string at all must behave like the original call. Values
// use `{ values: 'falsy' }` so an empty dropdown selection ("Any status",
// "Any date") is treated as absent rather than as a validation failure — the
// workspace sends '' for an unfiltered dropdown.
// ---------------------------------------------------------------------------

// "Any date" is '' ; every other value is either the literal 'today' or a
// positive day count. The literal is allowed so a blank-vs-today choice is
// expressible without a second parameter.
const dateRangeValidator = query('dateRange')
  .optional({ values: 'falsy' })
  .custom((value) => {
    if (value === 'today') return true;
    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new Error('dateRange must be "today" or a whole number of days between 1 and 365');
    }
    return true;
  });

const adminApplicationQueryValidators = [
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50'),
  query('q')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('q must be at most 200 characters'),
  // Reuses the canonical enum. An unknown status is rejected rather than
  // silently ignored, so a filter typo cannot masquerade as "no filter".
  query('status')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (value === 'all') return true;
      if (!APPLICATION_STATUSES.includes(value)) {
        throw new Error(`Status must be one of: ${APPLICATION_STATUSES.join(', ')}`);
      }
      return true;
    }),
  query('job')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('job must be a valid id'),
  query('recruiter')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('recruiter must be a valid id'),
  dateRangeValidator,
  runValidation,
];

// GET /api/admin/jobseekers/:userId — the applicant profile viewer. The id is a
// user id, not an application id, so it gets its own named-param validator.
const jobseekerIdParamValidators = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid jobseeker id'),
  runValidation,
];

// ---------------------------------------------------------------------------
// GET /api/admin/jobseekers — the Admin Jobseekers workspace list.
//
// Every filter is optional. `{ values: 'falsy' }` is used throughout so an
// empty dropdown selection ("Any location", "Any date") is treated as absent
// rather than failing validation.
const adminJobseekerQueryValidators = [
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50'),
  query('q')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('q must be at most 200 characters'),
  query('location')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 160 })
    .withMessage('location must be at most 160 characters'),
  dateRangeValidator,
  runValidation,
];

module.exports = {
  createValidators,
  jobIdParamValidators,
  applicationIdValidators,
  statusUpdateValidators,
  adminApplicationQueryValidators,
  jobseekerIdParamValidators,
  adminJobseekerQueryValidators,
  runValidation,
};

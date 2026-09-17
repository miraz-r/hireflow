const { body, param, validationResult } = require('express-validator');

// The existing Application.status enum values. Kept here so route validation
// and the model never drift apart accidentally.
const APPLICATION_STATUSES = ['applied', 'under-review', 'interview', 'offer', 'hired', 'rejected'];

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
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ max: 32 })
    .withMessage('Phone must be at most 32 characters'),
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
    .withMessage('Status must be one of: applied, under-review, interview, offer, hired, rejected'),
  runValidation,
];

module.exports = {
  createValidators,
  jobIdParamValidators,
  applicationIdValidators,
  statusUpdateValidators,
  runValidation,
};

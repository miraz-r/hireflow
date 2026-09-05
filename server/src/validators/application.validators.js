const { body, param, validationResult } = require('express-validator');

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
  runValidation,
];

// GET /api/applications/:jobId/me — the job id is a URL param.
const jobIdParamValidators = [
  param('jobId')
    .isMongoId()
    .withMessage('Invalid job id'),
  runValidation,
];

module.exports = {
  createValidators,
  jobIdParamValidators,
  runValidation,
};

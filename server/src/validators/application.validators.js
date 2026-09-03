const { body, param, validationResult } = require('express-validator');

const runValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  return next();
};

// POST /api/applications — body must carry a valid job id.
const createValidators = [
  body('jobId')
    .isMongoId()
    .withMessage('jobId must be a valid id'),
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

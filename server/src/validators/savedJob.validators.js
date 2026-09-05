const { body, param, validationResult } = require('express-validator');

const runValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  return next();
};

// POST /api/saved-jobs — body must carry a valid job id.
const saveJobValidators = [
  body('jobId')
    .isMongoId()
    .withMessage('jobId must be a valid id'),
  runValidation,
];

// GET/DELETE /api/saved-jobs/check/:jobId and /:jobId — the job id is a URL param.
const jobIdParamValidators = [
  param('jobId')
    .isMongoId()
    .withMessage('Invalid job id'),
  runValidation,
];

module.exports = {
  saveJobValidators,
  jobIdParamValidators,
  runValidation,
};

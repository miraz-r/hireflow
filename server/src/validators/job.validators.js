const { query, body, validationResult } = require('express-validator');

// ---------------------------------------------------------------------------
// Shared optional field validators
// ---------------------------------------------------------------------------
const optionalValidators = [
  body('title')
    .optional()
    .isString()
    .withMessage('title must be a string')
    .trim()
    .isLength({ min: 1, max: 160 })
    .withMessage('title must be 1-160 characters'),

  body('company')
    .optional()
    .isString()
    .withMessage('company must be a string')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('company must be 1-200 characters'),

  body('location')
    .optional()
    .isString()
    .withMessage('location must be a string')
    .trim()
    .isLength({ min: 1, max: 160 })
    .withMessage('location must be 1-160 characters'),

  body('workType')
    .optional()
    .isIn(['Remote', 'Hybrid', 'On-site'])
    .withMessage('workType must be Remote, Hybrid, or On-site'),

  body('employmentType')
    .optional()
    .isIn(['Full-time', 'Part-time', 'Contract'])
    .withMessage('employmentType must be Full-time, Part-time, or Contract'),

  body('experienceLevel')
    .optional()
    .isIn(['Entry-level', 'Mid-level', 'Senior', 'Lead', 'Manager'])
    .withMessage('experienceLevel must be Entry-level, Mid-level, Senior, Lead, or Manager'),

  body('category')
    .optional()
    .isString()
    .withMessage('category must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('category must be 1-100 characters'),

  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string')
    .trim()
    .isLength({ max: 2000 })
    .withMessage('description cannot exceed 2000 characters'),

  body('accent')
    .optional()
    .isString()
    .withMessage('accent must be a string')
    .trim()
    .isLength({ max: 40 })
    .withMessage('accent cannot exceed 40 characters'),

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

  body('salary')
    .optional()
    .isObject()
    .withMessage('salary must be an object'),
  body('salary.min')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('salary.min must be a non-negative number'),
  body('salary.max')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('salary.max must be a non-negative number'),
  body('salary.currency')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 10 })
    .withMessage('salary.currency cannot exceed 10 characters'),
  body('salary.period')
    .optional()
    .isIn(['yearly', 'hourly'])
    .withMessage('salary.period must be yearly or hourly'),
];

// Required fields for creation (on top of optional validators).
const createRequiredValidators = [
  body('title')
    .exists({ values: 'falsy' })
    .withMessage('title is required'),
  body('company')
    .exists({ values: 'falsy' })
    .withMessage('company is required'),
  body('location')
    .exists({ values: 'falsy' })
    .withMessage('location is required'),
  body('workType')
    .exists({ values: 'falsy' })
    .withMessage('workType is required'),
  body('employmentType')
    .exists({ values: 'falsy' })
    .withMessage('employmentType is required'),
  body('experienceLevel')
    .exists({ values: 'falsy' })
    .withMessage('experienceLevel is required'),
  body('category')
    .exists({ values: 'falsy' })
    .withMessage('category is required'),
];

// ---------------------------------------------------------------------------
// Query validators for the public list endpoint
// ---------------------------------------------------------------------------
const listQueryValidators = [
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('q cannot exceed 100 characters'),
  query('category')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('category cannot exceed 100 characters'),
  query('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('location cannot exceed 100 characters'),
  query('workType')
    .optional()
    .isIn(['Remote', 'Hybrid', 'On-site'])
    .withMessage('Invalid workType'),
  query('employmentType')
    .optional()
    .isIn(['Full-time', 'Part-time', 'Contract'])
    .withMessage('Invalid employmentType'),
  query('experienceLevel')
    .optional()
    .isIn(['Entry-level', 'Mid-level', 'Senior', 'Lead', 'Manager'])
    .withMessage('Invalid experienceLevel'),
  query('minSalary')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minSalary must be a non-negative number'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
];

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

const createValidators = [...createRequiredValidators, ...optionalValidators, runValidation];
const updateValidators = [...optionalValidators, runValidation];

module.exports = {
  optionalValidators,
  createValidators,
  updateValidators,
  listQueryValidators,
  runValidation,
};

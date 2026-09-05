const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  listSavedJobs,
  saveJob,
  unsaveJob,
  checkSaved,
} = require('../controllers/savedJob.controller');
const {
  saveJobValidators,
  jobIdParamValidators,
} = require('../validators/savedJob.validators');

const router = express.Router();

router.use(authenticate);
router.use(authorize('jobseeker'));

router.get('/', listSavedJobs);
router.post('/', saveJobValidators, saveJob);
router.get('/check/:jobId', jobIdParamValidators, checkSaved);
router.delete('/:jobId', jobIdParamValidators, unsaveJob);

module.exports = router;

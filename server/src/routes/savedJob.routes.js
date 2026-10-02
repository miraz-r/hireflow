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

// READS of the caller's own saved jobs are available in any workspace. The
// rows belong to the account (scoped on req.user.id in the controller), not to
// the jobseeker workspace, so switching must not hide them. The caller can
// only ever see their own saved jobs.
//
// WRITES remain jobseeker-workspace actions: saving and unsaving a job is
// something you do while you are looking for work.
router.get('/', listSavedJobs);
router.get('/check/:jobId', jobIdParamValidators, checkSaved);

router.post('/', authorize('jobseeker'), saveJobValidators, saveJob);
router.delete('/:jobId', authorize('jobseeker'), jobIdParamValidators, unsaveJob);

module.exports = router;

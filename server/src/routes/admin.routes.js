const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getStats } = require('../controllers/admin.controller');

const router = express.Router();

router.get('/', authenticate, authorize('admin'), getStats);

module.exports = router;

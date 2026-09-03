const express = require('express');
const { isDBConnected } = require('../config/db');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'hireflow-api',
    uptime: Math.round(process.uptime()),
    database: isDBConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
const express = require('express');
const { isDBConnected } = require('../config/db');

const router = express.Router();

// Liveness: the process is up and serving. Used by container/platform liveness
// probes; always 200 once the server is listening.
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'hireflow-api',
    uptime: Math.round(process.uptime()),
    database: isDBConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Readiness: the app can actually serve traffic. Fails (503) until MongoDB is
// reachable, so load balancers/orchestrators do not route traffic to an
// instance that cannot answer real requests.
router.get('/ready', (req, res) => {
  if (!isDBConnected()) {
    return res.status(503).json({
      status: 'unavailable',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(200).json({
    status: 'ready',
    database: 'connected',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
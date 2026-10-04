const app = require('./app');
const env = require('./config/env');
const { connectDB, isDBConnected } = require('./config/db');

const start = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[startup] Database connection failed. Health endpoint will reflect status.');
    if (env.nodeEnv === 'production') {
      // Never report a healthy process in production when its required
      // dependency is missing — fail fast and let the supervisor restart.
      console.error('[startup] NODE_ENV=production: exiting because MongoDB is unreachable.');
      process.exit(1);
    }
  }

  const server = app.listen(env.port, () => {
    console.log(`[server] HireFlow API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[server] CORS origin: ${env.clientOrigin}`);
    console.log(`[server] MongoDB status: ${isDBConnected() ? 'connected' : 'disconnected'}`);
  });

  const shutdown = (signal) => {
    console.log(`\n[shutdown] ${signal} received, closing server`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[fatal] Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[fatal] Uncaught exception:', err);
    shutdown('uncaughtException');
  });
};

start();
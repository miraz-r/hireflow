module.exports = (err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }
  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : err.message || 'Error',
  });
};
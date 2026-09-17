const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = auth.slice(7);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // The JWT is a signed claim, not proof of current identity. Re-check the
  // persisted user so a deleted account or a stale (pre-role-switch) token is
  // rejected instead of being trusted until the JWT naturally expires.
  let user;
  try {
    user = await User.findById(decoded.id);
  } catch (err) {
    // An unparseable id in a server-signed token means the token is garbage.
    if (err && err.name === 'CastError') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next(err);
  }

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (user.role !== decoded.role) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Identity is sourced from the current database document, not the token.
  req.user = { id: user.id, role: user.role };
  return next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
};

module.exports = { authenticate, authorize };
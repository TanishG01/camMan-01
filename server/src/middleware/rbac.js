const ApiError = require('../utils/ApiError');

const ROLE_LEVELS = { admin: 3, senior: 2, junior: 1 };

const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, `Access denied. Required roles: ${allowedRoles.join(', ')}.`));
  }
  next();
};

const requireMinRole = (minRole) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  if (ROLE_LEVELS[req.user.role] < ROLE_LEVELS[minRole]) {
    return next(new ApiError(403, `Access denied. Minimum role required: ${minRole}.`));
  }
  next();
};

module.exports = { requireRole, requireMinRole };

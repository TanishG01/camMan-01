const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) throw new ApiError(401, 'Not authenticated. Please log in.');

    const decoded = jwt.verify(token, (process.env.JWT_SECRET || 'festops_super_secret_jwt_key_at_least_64_characters_long_for_security_1234567890'));
    const user = await User.findById(decoded.userId).select('-__v');
    if (!user || !user.isActive) throw new ApiError(401, 'User account not found or inactive.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { protect };

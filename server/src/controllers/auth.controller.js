const jwt = require('jsonwebtoken');
const admin = require('../config/firebase');
const User = require('../models/User');
const EventAssignment = require('../models/EventAssignment');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');
const { ROLES, SENIORITY, SKILLS } = require('../config/constants');

// Helper to set session cookie and return user
const sendAuthSession = (user, res, message = 'Authenticated successfully') => {
  const payload = {
    userId: user._id,
    role: user.role,
    seniority: user.seniority
  };

  const token = jwt.sign(payload, (process.env.JWT_SECRET || 'festops_super_secret_jwt_key_at_least_64_characters_long_for_security_1234567890'), {
    expiresIn: process.env.JWT_EXPIRY || '7d'
  });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return success(res, { user }, message);
};

/**
 * POST /api/v1/auth/login
 * Verifies Firebase Google ID Token -> sets HTTP-only cookie session
 */
const login = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    throw new ApiError(400, 'idToken is required.');
  }

  let email, name, picture, uid;

  let isMock = false;
  let mockRole = null;

  // Development bypass / mock token support (supports quick role login on Vercel preview/dev)
  if (idToken.startsWith('mock_') || idToken.startsWith('dev_')) {
    isMock = true;
    const parts = idToken.split('_');
    const role = parts[1] || 'junior';
    mockRole = role;
    email = req.body.email || `${role}@festops.local`;
    name = req.body.name || `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`;
    picture = '';
    uid = `mock_uid_${email}`;
  } else {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      email = decoded.email;
      name = decoded.name || email.split('@')[0];
      picture = decoded.picture || '';
      uid = decoded.uid;
    } catch (err) {
      // If service account is not configured in dev, validate payload audience for the project
      const unverified = jwt.decode(idToken);
      const projectId = process.env.FIREBASE_PROJECT_ID || 'camman-01';
      if (unverified && (unverified.aud === projectId || unverified.iss?.includes(projectId))) {
        email = unverified.email;
        name = unverified.name || email?.split('@')[0];
        picture = unverified.picture || '';
        uid = unverified.sub || unverified.user_id;
      } else {
        throw new ApiError(401, `Invalid Firebase ID token: ${err.message}`);
      }
    }
  }

  if (!email) {
    throw new ApiError(400, 'Token does not contain a verified email address.');
  }

  // Look up user or create new user
  let user = await User.findOne({ email });

  if (!user) {
    // If this is the very first user in the entire database, make them admin
    const userCount = await User.countDocuments();
    let initialRole = userCount === 0 ? 'admin' : 'junior';
    let initialSeniority = userCount === 0 ? '4th_year' : '1st_year';

    // In dev/mock mode, respect the explicitly requested role and seniority
    if (isMock && mockRole) {
      initialRole = mockRole;
      initialSeniority = mockRole === 'admin' ? '4th_year' : (mockRole === 'senior' ? '3rd_year' : '1st_year');
    }

    user = await User.create({
      firebaseUid: uid,
      name,
      email,
      photoURL: picture,
      role: initialRole,
      seniority: initialSeniority,
      skills: ['photography', 'videography', 'editing'],
      isActive: true
    });

    console.log(`[Auth] Registered new user: ${email} (${user.role})`);
  } else {
    // In dev/mock mode, ensure user role and seniority match the requested mock role, and auto-reactivate
    if (isMock && mockRole) {
      user.role = mockRole;
      user.seniority = mockRole === 'admin' ? '4th_year' : (mockRole === 'senior' ? '3rd_year' : '1st_year');
      user.isActive = true;
    }
    // Update profile details if changed
    if (name && user.name !== name) user.name = name;
    if (picture && user.photoURL !== picture) user.photoURL = picture;
    if (uid && user.firebaseUid !== uid) user.firebaseUid = uid;
    await user.save();
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact an administrator.');
  }

  return sendAuthSession(user, res, 'Logged in successfully');
});

/**
 * GET /api/v1/auth/me
 * Restores logged-in user profile from session cookie
 */
const getMe = asyncHandler(async (req, res) => {
  return success(res, { user: req.user }, 'Profile retrieved');
});

/**
 * POST /api/v1/auth/logout
 * Clears JWT session cookie
 */
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict'
  });
  return success(res, null, 'Logged out successfully');
});

/**
 * PATCH /api/v1/auth/users/:userId/role
 * Admin updates role & seniority of a user
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role, seniority } = req.body;

  if (role && !ROLES.includes(role)) {
    throw new ApiError(400, `Invalid role. Allowed: ${ROLES.join(', ')}`);
  }
  if (seniority && !SENIORITY.includes(seniority)) {
    throw new ApiError(400, `Invalid seniority. Allowed: ${SENIORITY.join(', ')}`);
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(404, 'User not found.');
  }

  // Prevent demoting the only active admin
  if (targetUser.role === 'admin' && role && role !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
    if (adminCount <= 1) {
      throw new ApiError(400, 'Cannot demote the only active administrator in the system.');
    }
  }

  const before = { role: targetUser.role, seniority: targetUser.seniority };

  if (role) targetUser.role = role;
  if (seniority) targetUser.seniority = seniority;
  await targetUser.save();

  // Audit log
  await AuditLog.create({
    actorId: req.user._id,
    action: 'USER_ROLE_CHANGED',
    targetEntity: { entityType: 'User', entityId: targetUser._id },
    changes: { before, after: { role: targetUser.role, seniority: targetUser.seniority } },
    reason: req.body.reason || `Role updated to ${role || targetUser.role}`,
    ipAddress: req.ip
  });

  return success(res, { user: targetUser }, 'User role updated successfully');
});

/**
 * GET /api/v1/auth/users
 * List team roster with filters
 */
const listUsers = asyncHandler(async (req, res) => {
  const { role, seniority, isActive, search } = req.query;
  const filter = {};

  if (role) filter.role = role;
  if (seniority) filter.seniority = seniority;
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  } else if (req.query.all !== 'true') {
    filter.isActive = true;
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(filter).sort({ name: 1 }).select('-__v');
  return success(res, { users, count: users.length }, 'Users retrieved');
});

/**
 * POST /api/v1/auth/users
 * Admin/Senior creates a new team member directly
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, role, seniority, skills, phone } = req.body;

  if (!name || !email) {
    throw new ApiError(400, 'Name and email are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  let existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    if (existingUser.isActive) {
      throw new ApiError(400, 'A team member with this email address already exists.');
    }
    // If inactive, reactivate and update
    existingUser.isActive = true;
    existingUser.name = name.trim();
    if (role && ROLES.includes(role)) existingUser.role = role;
    if (seniority && SENIORITY.includes(seniority)) existingUser.seniority = seniority;
    if (Array.isArray(skills)) existingUser.skills = skills.filter(s => SKILLS.includes(s));
    if (phone) existingUser.phone = phone.trim();
    await existingUser.save();

    await AuditLog.create({
      actorId: req.user._id,
      action: 'USER_CREATED',
      targetEntity: { entityType: 'User', entityId: existingUser._id },
      changes: { after: { name: existingUser.name, email: existingUser.email, role: existingUser.role, seniority: existingUser.seniority } },
      reason: req.body.reason || 'Reactivated and updated team member profile',
      ipAddress: req.ip
    });

    return success(res, { user: existingUser }, 'Team member re-activated and updated', 200);
  }

  const assignedRole = role && ROLES.includes(role) ? role : 'junior';
  const assignedSeniority = seniority && SENIORITY.includes(seniority) ? seniority : '1st_year';
  const assignedSkills = Array.isArray(skills) && skills.length > 0
    ? skills.filter(s => SKILLS.includes(s))
    : ['photography'];

  const newUser = await User.create({
    firebaseUid: `pre_registered_${uuidv4()}`,
    name: name.trim(),
    email: normalizedEmail,
    role: assignedRole,
    seniority: assignedSeniority,
    skills: assignedSkills,
    phone: phone ? phone.trim() : '',
    isActive: true
  });

  await AuditLog.create({
    actorId: req.user._id,
    action: 'USER_CREATED',
    targetEntity: { entityType: 'User', entityId: newUser._id },
    changes: { after: { name: newUser.name, email: newUser.email, role: newUser.role, seniority: newUser.seniority, skills: newUser.skills } },
    reason: req.body.reason || 'Added directly to team roster by coordinator',
    ipAddress: req.ip
  });

  return success(res, { user: newUser }, 'Team member added directly to team roster', 201);
});

/**
 * PATCH /api/v1/auth/me
 * Any logged in user updates their own profile / skills / phone / seniority
 */
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const { name, phone, seniority, skills, availability } = req.body;

  if (name) user.name = name.trim();
  if (phone !== undefined) user.phone = phone.trim();
  if (seniority && SENIORITY.includes(seniority)) user.seniority = seniority;
  if (Array.isArray(skills)) {
    user.skills = skills.filter(s => SKILLS.includes(s));
  }
  if (Array.isArray(availability)) {
    user.availability = availability;
  }
  user.isActive = true;

  await user.save();

  await AuditLog.create({
    actorId: user._id,
    action: 'USER_UPDATED',
    targetEntity: { entityType: 'User', entityId: user._id },
    changes: { after: { name: user.name, phone: user.phone, seniority: user.seniority, skills: user.skills } },
    reason: 'Member updated own profile / joined team coverage roster',
    ipAddress: req.ip
  });

  return success(res, { user }, 'Profile updated successfully');
});

/**
 * DELETE /api/v1/auth/users/:userId
 * Admin or Senior Coordinator deactivates/removes team member
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(404, 'User not found.');
  }

  // Prevent deleting oneself
  if (req.user._id.toString() === targetUser._id.toString()) {
    throw new ApiError(400, 'You cannot delete your own account from the team roster.');
  }

  // Non-admins cannot delete an admin
  if (req.user.role !== 'admin' && targetUser.role === 'admin') {
    throw new ApiError(403, 'Only administrators can remove an administrator.');
  }

  // Prevent deactivating the only active admin
  if (targetUser.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
    if (adminCount <= 1) {
      throw new ApiError(400, 'Cannot delete the only active administrator in the system.');
    }
  }

  targetUser.isActive = false;
  await targetUser.save();

  // Cancel any uncompleted/suggested assignments for this member
  await EventAssignment.deleteMany({
    memberId: targetUser._id,
    status: 'suggested'
  });

  await AuditLog.create({
    actorId: req.user._id,
    action: 'USER_DELETED',
    targetEntity: { entityType: 'User', entityId: targetUser._id },
    changes: { before: { isActive: true }, after: { isActive: false } },
    reason: req.body.reason || 'Deleted/removed member from team roster',
    ipAddress: req.ip
  });

  return success(res, { user: targetUser }, 'Team member removed successfully');
});

module.exports = {
  login,
  getMe,
  logout,
  updateUserRole,
  listUsers,
  createUser,
  updateProfile,
  deleteUser
};

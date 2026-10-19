const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/rbac');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, authController.login);
router.get('/me', protect, authController.getMe);
router.patch('/me', protect, authController.updateProfile);
router.post('/logout', protect, authController.logout);
router.post('/users', protect, requireMinRole('senior'), authController.createUser);
router.get('/users', protect, authController.listUsers);
router.patch('/users/:userId/role', protect, requireRole(['admin']), authController.updateUserRole);
router.delete('/users/:userId', protect, requireMinRole('senior'), authController.deleteUser);

module.exports = router;

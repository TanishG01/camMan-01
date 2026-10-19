const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

router.get('/', protect, notificationController.getMyNotifications);
router.post('/:id/read', protect, notificationController.markAsRead);
router.post('/read-all', protect, notificationController.markAllAsRead);

module.exports = router;

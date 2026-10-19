const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const eventController = require('../controllers/event.controller');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.get('/', protect, eventController.getEvents);
router.get('/:eventId', protect, eventController.getEventById);
router.post('/', protect, requireRole(['admin', 'senior']), eventController.createEvent);
router.patch('/:eventId', protect, requireRole(['admin', 'senior']), eventController.updateEvent);
router.delete('/:eventId', protect, requireRole(['admin', 'senior']), eventController.deleteEvent);
router.post('/:eventId/delay', protect, eventController.delayEvent);
router.post('/:eventId/cancel', protect, eventController.cancelEvent);

router.post('/import/preview', protect, requireRole(['admin', 'senior']), upload.single('file'), eventController.importPreview);
router.post('/import/commit', protect, requireRole(['admin', 'senior']), eventController.importCommit);

module.exports = router;

const express = require('express');
const router = express.Router();
const festController = require('../controllers/fest.controller');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const venueRoutes = require('./venue.routes');
const eventRoutes = require('./event.routes');

router.get('/', protect, festController.getFests);
router.get('/:festId', protect, festController.getFestById);
router.post('/', protect, requireRole(['admin', 'senior']), festController.createFest);
router.patch('/:festId', protect, requireRole(['admin', 'senior']), festController.updateFest);
router.patch('/:festId/status', protect, requireRole(['admin', 'senior']), festController.updateFestStatus);
router.delete('/:festId', protect, requireRole(['admin', 'senior']), festController.deleteFest);

// Mount nested routes
router.use('/:festId/venues', venueRoutes);
router.use('/:festId/events', eventRoutes);

module.exports = router;

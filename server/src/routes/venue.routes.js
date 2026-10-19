const express = require('express');
const router = express.Router({ mergeParams: true });
const venueController = require('../controllers/venue.controller');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/', protect, venueController.getVenues);
router.post('/', protect, requireRole(['admin']), venueController.createVenue);
router.patch('/:venueId', protect, requireRole(['admin']), venueController.updateVenue);

module.exports = router;

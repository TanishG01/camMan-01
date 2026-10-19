const express = require('express');
const router = express.Router();
const coverageController = require('../controllers/coverage.controller');
const { protect } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/rbac');

router.get('/', protect, coverageController.getCoverage);
router.post('/report', protect, coverageController.reportCoverage);
router.post('/unplanned', protect, coverageController.reportUnplanned);
router.post('/:id/validate', protect, requireMinRole('senior'), coverageController.validateCoverage);

module.exports = router;

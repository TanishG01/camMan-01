const express = require('express');
const router = express.Router();
const footageController = require('../controllers/footage.controller');
const { protect } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/rbac');

router.get('/', protect, footageController.listFootage);
router.post('/:id/initiate-handover', protect, footageController.initiateHandover);
router.post('/:id/confirm-handover', protect, requireMinRole('senior'), footageController.confirmHandover);
router.patch('/:id/backup', protect, requireMinRole('senior'), footageController.updateBackup);
router.post('/:id/flag-issue', protect, footageController.flagIssue);
router.post('/:id/resolve-issue/:issueIndex', protect, requireMinRole('senior'), footageController.resolveIssue);
router.post('/:id/verify', protect, requireMinRole('senior'), footageController.verifyFootage);

module.exports = router;

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All audit routes are strictly restricted to admin
router.get('/', protect, requireRole(['admin']), auditController.getAuditLogs);
router.get('/export', protect, requireRole(['admin']), auditController.exportAuditLogs);

// NOTE: No POST, PUT, PATCH, or DELETE routes exist for AuditLog.
// The audit trail is strictly immutable and write-only via internal auditService.

module.exports = router;

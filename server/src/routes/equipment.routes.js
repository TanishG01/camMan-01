const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipment.controller');
const { protect } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/rbac');

router.get('/', protect, equipmentController.listEquipment);
router.get('/:id', protect, equipmentController.getEquipmentById);
router.post('/', protect, requireRole(['admin']), equipmentController.createEquipment);
router.patch('/:id/condition', protect, requireMinRole('senior'), equipmentController.updateCondition);
router.post('/:id/reserve', protect, requireRole(['admin']), equipmentController.reserveEquipment);
router.post('/:id/allocate', protect, requireRole(['admin']), equipmentController.allocateEquipment);
router.post('/:id/checkout', protect, requireMinRole('senior'), equipmentController.checkoutEquipment);
router.post('/:id/take', protect, equipmentController.takeEquipment);
router.post('/:id/return', protect, equipmentController.returnEquipment);
router.post('/:id/report-lost', protect, requireMinRole('senior'), equipmentController.reportLost);
router.post('/:id/send-to-maintenance', protect, requireRole(['admin']), equipmentController.sendToMaintenance);
router.post('/:id/restore-from-maintenance', protect, requireRole(['admin']), equipmentController.restoreFromMaintenance);
router.get('/:id/sequential-feasibility', protect, requireMinRole('senior'), equipmentController.checkSequentialFeasibility);

module.exports = router;

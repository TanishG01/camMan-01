const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');
const { protect } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/rbac');

router.get('/', protect, assignmentController.getAssignments);
router.post('/', protect, requireMinRole('senior'), assignmentController.createAssignment);
router.post('/suggest', protect, requireMinRole('senior'), assignmentController.suggestAssignments);
router.post('/:id/approve', protect, requireMinRole('senior'), assignmentController.approveAssignment);
router.post('/:id/reject', protect, requireMinRole('senior'), assignmentController.rejectAssignment);
router.delete('/:id', protect, requireMinRole('senior'), assignmentController.deleteAssignment);
router.post('/:id/reassign', protect, requireMinRole('senior'), assignmentController.reassignMember);
router.post('/:id/assign-mentor', protect, requireMinRole('senior'), assignmentController.assignMentor);
router.post('/:id/request-mentor', protect, assignmentController.requestMentor);
router.patch('/:id/confirm-contribution', protect, requireMinRole('senior'), assignmentController.confirmContribution);

module.exports = router;

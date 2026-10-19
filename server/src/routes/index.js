const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const festRoutes = require('./fest.routes');
const assignmentRoutes = require('./assignment.routes');
const equipmentRoutes = require('./equipment.routes');
const coverageRoutes = require('./coverage.routes');
const footageRoutes = require('./footage.routes');
const notificationRoutes = require('./notification.routes');
const auditRoutes = require('./audit.routes');

// Health check
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FestOps API running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.use('/auth', authRoutes);
router.use('/fests', festRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/coverage', coverageRoutes);
router.use('/footage', footageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit', auditRoutes);

module.exports = router;

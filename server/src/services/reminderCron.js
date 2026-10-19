const cron = require('node-cron');
const Event = require('../models/Event');
const EventAssignment = require('../models/EventAssignment');
const EquipmentAssignment = require('../models/EquipmentAssignment');
const FootageRecord = require('../models/FootageRecord');
const notificationService = require('./notificationService');

const initCronJobs = () => {
  console.log('[Cron] Initializing scheduled reminder background jobs...');

  // Job 1: Event Reminders (every 5 minutes in production, every minute for dev)
  const job1 = cron.schedule('*/5 * * * *', async () => {
    try {
      const reminderMinutes = parseInt(process.env.REMINDER_MINUTES_BEFORE_EVENT, 10) || 30;
      const now = new Date();
      const cutoff = new Date(now.getTime() + reminderMinutes * 60000);

      const events = await Event.find({
        status: 'scheduled',
        startTime: { $gte: now, $lte: cutoff }
      });

      for (const event of events) {
        const assignments = await EventAssignment.find({ eventId: event._id, status: 'approved' });
        for (const assignment of assignments) {
          await notificationService.createNotification({
            recipientId: assignment.memberId,
            type: 'equipment_due',
            title: `Event Starting Soon: "${event.name}"`,
            message: `Starts at ${new Date(event.startTime).toLocaleTimeString()}. Check equipment and report to venue.`,
            relatedEntity: { entityType: 'Event', entityId: event._id }
          });
        }
      }
    } catch (err) {
      console.error('[Cron Job 1] Error running event reminders:', err.message);
    }
  });

  // Job 2: Overdue Equipment Check (every 30 minutes)
  const job2 = cron.schedule('*/30 * * * *', async () => {
    try {
      const overdueAssignments = await EquipmentAssignment.find({
        status: 'checked_out',
        expectedReturnTime: { $lt: new Date() }
      }).populate('equipmentId assignedHolderId');

      for (const assignment of overdueAssignments) {
        if (!assignment.assignedHolderId) continue;
        await notificationService.createNotification({
          recipientId: assignment.assignedHolderId._id,
          type: 'equipment_overdue',
          title: `Overdue Equipment Return: ${assignment.equipmentId?.equipmentId}`,
          message: `${assignment.equipmentId?.equipmentId} was expected by ${new Date(assignment.expectedReturnTime).toLocaleTimeString()}. Please return to desk immediately.`,
          relatedEntity: { entityType: 'EquipmentAssignment', entityId: assignment._id }
        });
      }
    } catch (err) {
      console.error('[Cron Job 2] Error checking overdue equipment:', err.message);
    }
  });

  // Job 3: SD Card Handover Reminder (hourly)
  const job3 = cron.schedule('0 * * * *', async () => {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const pendingFootage = await FootageRecord.find({
        handoverStatus: { $in: ['not_yet_handed_over', 'handover_pending'] },
        createdAt: { $lt: twoHoursAgo }
      }).populate('sdCardId currentCustodianId');

      for (const footage of pendingFootage) {
        if (!footage.currentCustodianId) continue;
        await notificationService.createNotification({
          recipientId: footage.currentCustodianId._id,
          type: 'handover_reminder',
          title: `SD Card Handover Pending: ${footage.sdCardId?.equipmentId}`,
          message: `You are currently holding ${footage.sdCardId?.equipmentId}. Please physically hand over the card to a team lead.`,
          relatedEntity: { entityType: 'FootageRecord', entityId: footage._id }
        });
      }
    } catch (err) {
      console.error('[Cron Job 3] Error checking pending handovers:', err.message);
    }
  });

  return { job1, job2, job3 };
};

module.exports = {
  initCronJobs
};

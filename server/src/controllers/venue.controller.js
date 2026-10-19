const Venue = require('../models/Venue');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const auditService = require('../services/auditService');

const createVenue = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const { name, locationNotes, travelBufferMinutes, setupBufferMinutes } = req.body;

  if (!name) {
    throw new ApiError(400, 'Venue name is required.');
  }

  const existing = await Venue.findOne({ festId, name: name.trim() });
  if (existing) {
    throw new ApiError(409, `A venue with name "${name}" already exists in this fest.`);
  }

  const venue = await Venue.create({
    festId,
    name: name.trim(),
    locationNotes: locationNotes || '',
    travelBufferMinutes: travelBufferMinutes !== undefined ? Number(travelBufferMinutes) : 10,
    setupBufferMinutes: setupBufferMinutes !== undefined ? Number(setupBufferMinutes) : 15
  });

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'VENUE_CREATED',
    targetEntity: { entityType: 'Venue', entityId: venue._id },
    changes: { after: venue.toObject() },
    req
  });

  return success(res, { venue }, 'Venue created successfully', 201);
});

const getVenues = asyncHandler(async (req, res) => {
  const { festId } = req.params;
  const venues = await Venue.find({ festId }).sort({ name: 1 });
  return success(res, { venues, count: venues.length }, 'Venues retrieved');
});

const updateVenue = asyncHandler(async (req, res) => {
  const { festId, venueId } = req.params;
  const venue = await Venue.findOne({ _id: venueId, festId });
  if (!venue) {
    throw new ApiError(404, 'Venue not found in this fest.');
  }

  const before = venue.toObject();
  const updatable = ['name', 'locationNotes', 'travelBufferMinutes', 'setupBufferMinutes'];
  updatable.forEach(k => {
    if (req.body[k] !== undefined) venue[k] = req.body[k];
  });

  await venue.save();

  await auditService.log({
    festId,
    actorId: req.user._id,
    action: 'VENUE_UPDATED',
    targetEntity: { entityType: 'Venue', entityId: venue._id },
    changes: { before, after: venue.toObject() },
    req
  });

  return success(res, { venue }, 'Venue updated successfully');
});

module.exports = {
  createVenue,
  getVenues,
  updateVenue
};

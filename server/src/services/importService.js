const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const Fest = require('../models/Fest');
const ApiError = require('../utils/ApiError');

// In-memory cache for preview tokens (TTL: 10 minutes)
const previewCache = new Map();

// Helper to cleanup expired previews
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, data] of previewCache.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      previewCache.delete(token);
    }
  }
}, 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Normalizes Excel times (e.g. 0.375, "9:00 AM", "14:30") to HH:MM format
 */
const normalizeExcelTime = (rawVal) => {
  if (rawVal === null || rawVal === undefined || rawVal === '') return '';

  const num = Number(rawVal);
  if (!isNaN(num) && typeof num === 'number') {
    // Fraction of a 24-hour day (e.g., 0.375 = 09:00, 0.5 = 12:00)
    if (num >= 0 && num < 1) {
      const totalMinutes = Math.round(num * 24 * 60);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    // Direct hour number (e.g., 9 or 9.5)
    if (num >= 1 && num < 24) {
      const h = Math.floor(num);
      const m = Math.round((num - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  const str = String(rawVal).trim();

  // 12-hour AM/PM format (e.g., "9:00 AM", "1:30 PM", "9am")
  const ampmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3].toLowerCase() === 'pm';
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Standard 24-hour HH:MM format
  const match24 = str.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (match24) {
    return `${String(match24[1]).padStart(2, '0')}:${match24[2]}`;
  }

  return str;
};

/**
 * Normalizes Excel dates (e.g. serial numbers, "10th December", "10/12/2026") to YYYY-MM-DD
 */
const normalizeExcelDate = (rawVal, defaultYear = new Date().getFullYear()) => {
  if (rawVal === null || rawVal === undefined || rawVal === '') return '';

  // 1. JS Date instance
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    const y = rawVal.getFullYear();
    const m = String(rawVal.getMonth() + 1).padStart(2, '0');
    const d = String(rawVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Excel serial date code (e.g. 45270)
  const num = Number(rawVal);
  if (!isNaN(num) && num > 1000) {
    try {
      const parsed = xlsx.SSF.parse_date_code(num);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (e) {
      // fallback
    }
  }

  let str = String(rawVal).trim();

  // 3. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 4. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 5. Ordinals like "10th December", "Dec 10th", "10 December"
  const cleanStr = str.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  let dateWithYear = cleanStr;
  if (!/\b\d{4}\b/.test(cleanStr)) {
    dateWithYear = `${cleanStr} ${defaultYear}`;
  }

  const parsedDate = new Date(dateWithYear);
  if (!isNaN(parsedDate.getTime())) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
};

/**
 * Parses an Excel (.xlsx) buffer and generates a validation preview
 */
const generatePreview = async (fileBuffer, festId) => {
  if (!fileBuffer) {
    throw new ApiError(400, 'Excel file buffer is required.');
  }

  let workbook;
  try {
    workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    throw new ApiError(400, `Failed to parse Excel file: ${err.message}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ApiError(400, 'The Excel workbook does not contain any sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new ApiError(400, 'The Excel sheet is empty.');
  }

  // Load fest information for default year context
  const fest = await Fest.findById(festId);
  const defaultYear = fest?.startDate ? new Date(fest.startDate).getFullYear() : new Date().getFullYear();

  // Load existing venues and events for this fest
  const existingVenues = await Venue.find({ festId });
  const venueMap = new Map(); // normalized name -> Venue doc
  existingVenues.forEach(v => venueMap.set(v.name.trim().toLowerCase(), v));

  const existingEvents = await Event.find({ festId });
  const eventSet = new Set();
  existingEvents.forEach(e => {
    const dStr = new Date(e.date).toISOString().split('T')[0];
    eventSet.add(`${e.name.trim().toLowerCase()}_${dStr}`);
  });

  const validRows = [];
  const warningRows = [];
  const errorRows = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1
    const errors = [];
    const warnings = [];

    // Normalizing column names (case-insensitive key lookup)
    const getRawVal = (colNames) => {
      for (const k of Object.keys(row)) {
        if (colNames.some(c => c.toLowerCase() === k.trim().toLowerCase())) {
          return row[k];
        }
      }
      return '';
    };

    const getVal = (colNames) => {
      const raw = getRawVal(colNames);
      return raw !== null && raw !== undefined ? String(raw).trim() : '';
    };

    const eventName = getVal(['Event Name', 'Event', 'Name']);
    const category = getVal(['Category', 'Event Category', 'Type']) || 'General';
    const rawDate = getRawVal(['Date', 'Event Date']);
    const rawStartTime = getRawVal(['Start Time', 'Start']);
    const rawEndTime = getRawVal(['End Time', 'End']);
    const venueName = getVal(['Venue', 'Location']);
    const minCoverage = parseInt(getVal(['Min Coverage (mins)', 'Min Coverage', 'Min Duration']), 10) || 15;
    const teamSize = parseInt(getVal(['Team Size', 'Team', 'Crew Size']), 10) || 2;
    const priority = (getVal(['Priority']) || 'medium').toLowerCase();
    const deliverablesRaw = getVal(['Deliverables', 'Deliverable']);
    const skillsRaw = getVal(['Skills', 'Required Skills']);

    if (!eventName) errors.push('Missing Event Name');
    if (!rawDate) errors.push('Missing Date (expected YYYY-MM-DD)');
    if (rawStartTime === '') errors.push('Missing Start Time (expected HH:MM)');
    if (rawEndTime === '') errors.push('Missing End Time (expected HH:MM)');
    if (!venueName) errors.push('Missing Venue');

    // Date normalization & validation
    const dateStr = normalizeExcelDate(rawDate, defaultYear);
    let eventDate = null;
    if (rawDate) {
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        errors.push(`Invalid date format: "${rawDate}". Use YYYY-MM-DD.`);
      } else {
        eventDate = parsedDate;
      }
    }

    // Time normalization & validation
    const startTimeStr = normalizeExcelTime(rawStartTime);
    const endTimeStr = normalizeExcelTime(rawEndTime);
    let startDateTime = null;
    let endDateTime = null;
    if (dateStr && rawStartTime !== '' && rawEndTime !== '') {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTimeStr)) {
        errors.push(`Invalid Start Time: "${rawStartTime}". Use 24h format HH:MM.`);
      }
      if (!timeRegex.test(endTimeStr)) {
        errors.push(`Invalid End Time: "${rawEndTime}". Use 24h format HH:MM.`);
      }

      if (timeRegex.test(startTimeStr) && timeRegex.test(endTimeStr) && eventDate) {
        const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        startDateTime = new Date(`${d}T${startTimeStr}:00`);
        endDateTime = new Date(`${d}T${endTimeStr}:00`);

        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          errors.push('Failed to parse combined start/end date-time.');
        } else if (startDateTime >= endDateTime) {
          errors.push(`Start time (${startTimeStr}) must be before end time (${endTimeStr}).`);
        }
      }
    }

    // Venue existence check
    let matchedVenue = null;
    if (venueName) {
      matchedVenue = venueMap.get(venueName.toLowerCase());
      if (!matchedVenue) {
        warnings.push(`Venue "${venueName}" does not exist yet. It will be created automatically upon import.`);
      }
    }

    // Duplicate event check
    if (eventName && dateStr) {
      const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const key = `${eventName.toLowerCase()}_${d}`;
      if (eventSet.has(key)) {
        warnings.push(`Duplicate: An event named "${eventName}" on ${d} already exists in this fest.`);
      }
    }

    // Deliverables parser
    const deliverables = deliverablesRaw
      ? deliverablesRaw.split(/[,;|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      : ['photos', 'videos'];

    // Skills parser
    const requiredSkills = skillsRaw
      ? skillsRaw.split(/[,;|]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      : ['photography'];

    const parsedRow = {
      rowIndex: index,
      rowNumber: rowNum,
      name: eventName,
      category,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      startDateTime: startDateTime?.toISOString(),
      endDateTime: endDateTime?.toISOString(),
      venueName,
      venueId: matchedVenue?._id?.toString() || null,
      minCoverageDurationMinutes: minCoverage,
      teamSizeRequired: teamSize,
      priority: ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium',
      requiredDeliverables: deliverables,
      requiredSkills,
      errors,
      warnings,
      status: errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'valid')
    };

    if (errors.length > 0) {
      errorRows.push(parsedRow);
    } else if (warnings.length > 0) {
      warningRows.push(parsedRow);
    } else {
      validRows.push(parsedRow);
    }
  });

  const previewToken = uuidv4();
  const allRows = [...validRows, ...warningRows, ...errorRows].sort((a, b) => a.rowIndex - b.rowIndex);

  previewCache.set(previewToken, {
    festId,
    rows: allRows,
    timestamp: Date.now()
  });

  return {
    previewToken,
    totalRows: rawRows.length,
    validCount: validRows.length,
    warningCount: warningRows.length,
    errorCount: errorRows.length,
    rows: allRows,
    summary: {
      canCommit: validRows.length + warningRows.length > 0,
      importableRows: validRows.length + warningRows.length
    }
  };
};

/**
 * Commits verified rows from a preview token
 */
const commitImport = async (previewToken, selectedRowIndexes, creatorUserId, filename = 'import.xlsx') => {
  const cached = previewCache.get(previewToken);
  if (!cached) {
    throw new ApiError(400, 'Import preview token is invalid or has expired (10 min TTL). Please re-upload the file.');
  }

  const { festId, rows } = cached;
  const indexSet = new Set(selectedRowIndexes);
  const rowsToImport = rows.filter(r => indexSet.has(r.rowIndex) && r.status !== 'error');

  if (rowsToImport.length === 0) {
    throw new ApiError(400, 'No valid rows were selected for import.');
  }

  // Create missing venues on the fly
  const existingVenues = await Venue.find({ festId });
  const venueMap = new Map();
  existingVenues.forEach(v => venueMap.set(v.name.trim().toLowerCase(), v));

  const eventsToCreate = [];

  for (const r of rowsToImport) {
    const vKey = r.venueName.trim().toLowerCase();
    let venue = venueMap.get(vKey);

    if (!venue) {
      venue = await Venue.create({
        festId,
        name: r.venueName.trim(),
        locationNotes: 'Auto-created from Excel import',
        travelBufferMinutes: 10,
        setupBufferMinutes: 15
      });
      venueMap.set(vKey, venue);
    }

    eventsToCreate.push({
      festId,
      venueId: venue._id,
      name: r.name,
      category: r.category,
      date: new Date(r.date),
      startTime: new Date(r.startDateTime),
      endTime: new Date(r.endDateTime),
      minCoverageDurationMinutes: r.minCoverageDurationMinutes,
      teamSizeRequired: r.teamSizeRequired,
      priority: r.priority,
      requiredDeliverables: r.requiredDeliverables,
      requiredSkills: r.requiredSkills,
      status: 'scheduled',
      createdBy: creatorUserId,
      importedFrom: filename
    });
  }

  const createdEvents = await Event.insertMany(eventsToCreate);

  // Clean up cache after commit
  previewCache.delete(previewToken);

  return {
    importedCount: createdEvents.length,
    events: createdEvents
  };
};

module.exports = {
  generatePreview,
  commitImport
};

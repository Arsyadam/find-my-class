/**
 * Find My Class — paste into Apps Script (Extensions → Apps Script → Code.gs)
 *
 * Setup:
 * 1. Open https://docs.google.com/spreadsheets/d/13iJQzRF4nPt-ri33CZkkJs57YtpEzpR3nh8CMverTjw/edit
 * 2. Extensions → Apps Script
 * 3. Delete any default code; paste this entire file into Code.gs
 * 4. Save → Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (or Anyone with Google account)
 * 5. Optional: Project Settings → Script properties → SHEETS_API_TOKEN
 * 6. Reload the sheet → Planner → Clear API cache (after edits)
 * 7. Put the Web app URL in Next.js as SHEETS_API_URL
 *
 * Bound spreadsheet ID is FMC.SHEET_ID below.
 * SyncSections / SyncRmp / RecomputeRankings are stubs — sheet is already populated.
 */


/* ===== Config.gs ===== */
/**
 * Find My Class — Apps Script config
 * Spreadsheet SoT: denormalized Winter/Spring term tabs (already populated).
 */
var FMC = {
  SHEET_ID: '13iJQzRF4nPt-ri33CZkkJs57YtpEzpR3nh8CMverTjw',
  /** term_code → tab name */
  TERMS: {
    '2271': 'Winter 2027',
    '2273': 'Spring 2027'
  },
  INSTITUTION: 'WA100',
  CACHE_SECONDS: 600,
  /** Human header → API field (missing headers are skipped) */
  COLUMN_MAP: {
    Term: 'term',
    'Term code': 'term_code',
    Subject: 'subject',
    Course: 'course_code',
    Title: 'title',
    Section: 'section',
    'Class #': 'class_nbr',
    Component: 'component',
    'Instruction mode': 'instruction_mode',
    Credits: 'credits',
    Session: 'session',
    Days: 'days',
    Times: 'times_raw',
    'Location / room': 'location',
    Campus: 'campus',
    Status: 'status',
    'Seats open': 'seats_open',
    Capacity: 'capacity',
    Enrolled: 'enrolled',
    Waitlist: 'waitlist',
    'Waitlist cap': 'waitlist_cap',
    'Instructor(s) (ctcLink)': 'instructor',
    'Staff/TBA?': 'staff_tba_raw',
    'RMP match': 'rmp_match',
    'Match confidence': 'match_confidence',
    'Match note': 'match_note',
    'RMP overall': 'rmp_overall',
    'RMP difficulty': 'rmp_difficulty',
    'RMP would take again %': 'rmp_would_take_again',
    'RMP # ratings': 'rmp_num_ratings',
    'RMP this-course quality': 'rmp_course_quality',
    'RMP this-course difficulty': 'rmp_course_difficulty',
    'RMP this-course WTA %': 'rmp_course_wta',
    'RMP this-course # ratings': 'rmp_course_num_ratings',
    'RMP URL': 'rmp_url',
    'Likely instructor (inferred, NOT confirmed)': 'inferred_instructor_raw',
    'Inference basis': 'inference_basis',
    'Inferred #1 RMP overall': 'inferred_rmp_overall',
    'Inferred #1 RMP difficulty': 'inferred_rmp_difficulty',
    'Inferred #1 RMP WTA %': 'inferred_rmp_wta',
    'Inferred #1 RMP # ratings': 'inferred_rmp_num_ratings',
    'Inferred #1 RMP URL': 'inferred_rmp_url',
    'Other inferred candidates': 'other_inferred_candidates',
    'ctcLink class details link': 'enroll_url',
    'Details link check': 'details_link_check'
  }
};

function fmcSpreadsheet_() {
  return SpreadsheetApp.openById(FMC.SHEET_ID);
}

function fmcHeaders_(sheet) {
  var values = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < values.length; i++) {
    if (values[i]) map[String(values[i]).trim()] = i;
  }
  return map;
}

function fmcTabForTerm_(termCode) {
  var tab = FMC.TERMS[String(termCode)];
  if (tab) return tab;
  // Fallback: find a sheet whose Term code column matches
  var ss = fmcSpreadsheet_();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (/readme|alias|meta|legend/i.test(name)) continue;
    var headers = fmcHeaders_(sheets[i]);
    var col = headers['Term code'];
    if (col == null) continue;
    var last = sheets[i].getLastRow();
    if (last < 2) continue;
    var sample = sheets[i].getRange(2, col + 1, Math.min(last, 20), col + 1).getValues();
    for (var r = 0; r < sample.length; r++) {
      if (String(sample[r][0]) === String(termCode)) return name;
    }
  }
  return null;
}

function fmcIsTruthyStaff_(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === 'y' || s === '1';
}

function fmcIsStaffName_(name) {
  var s = String(name || '')
    .trim()
    .toLowerCase();
  return !s || s === 'staff' || s === 'tba' || s === 'tbd' || s === 'instructor';
}

/** First listed inferred name, stripping "(inferred, not confirmed)" */
function fmcPrimaryInferred_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  if (/^no inference/i.test(s)) return '';
  var first = s.split(';')[0].trim();
  return first
    .replace(/\s*\(inferred,\s*not confirmed\)\s*/gi, '')
    .replace(/\s*\(inferred\)\s*/gi, '')
    .trim();
}

/**
 * Split "10:00 AM-11:50 AM" or multi "8:00 AM-9:25 AM; 8:00 AM-9:50 AM"
 * into start_time / end_time (earliest start, latest end across segments).
 */
function fmcParseTimes_(timesRaw) {
  var raw = String(timesRaw || '').trim();
  if (!raw || /^tba$/i.test(raw) || /^arr$/i.test(raw)) {
    return { start_time: '', end_time: '', times_raw: raw };
  }
  var parts = raw.split(';').map(function (p) {
    return p.trim();
  }).filter(Boolean);
  var starts = [];
  var ends = [];
  parts.forEach(function (p) {
    var m = p.match(
      /^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i
    );
    if (m) {
      starts.push(m[1].replace(/\s+/g, ' ').trim());
      ends.push(m[2].replace(/\s+/g, ' ').trim());
    }
  });
  if (!starts.length) {
    return { start_time: '', end_time: '', times_raw: raw };
  }
  // Prefer first meeting's start/end for display; keep raw for consumers
  return {
    start_time: starts[0],
    end_time: ends[0],
    times_raw: raw
  };
}

function fmcCatalogFromCourse_(courseCode) {
  var s = String(courseCode || '').trim();
  var m = s.match(/^(.+?)\s+(\S+)$/);
  if (!m) return { subject: s, catalog_nbr: '' };
  return { subject: m[1], catalog_nbr: m[2] };
}

function fmcConfirmedRmp_(row) {
  if (row.staff_tba) return false;
  var conf = String(row.match_confidence || '').toLowerCase();
  if (conf.indexOf('no match') >= 0) return false;
  if (fmcIsStaffName_(row.instructor) && !row.rmp_match) return false;
  var hasOverall =
    row.rmp_overall !== '' &&
    row.rmp_overall != null &&
    !isNaN(Number(row.rmp_overall));
  var hasMatch = String(row.rmp_match || '').trim().length > 0;
  return hasMatch || hasOverall;
}

/* ===== Api.gs ===== */
/**
 * Web app entry: ?term=2271&courses=ENGL%20128,CHEM%26%20161&token=...
 * Reads denormalized term tabs. Cached via CacheService for FMC.CACHE_SECONDS.
 */
function doGet(e) {
  e = e || { parameter: {} };
  var params = e.parameter || {};
  var tokenExpected = PropertiesService.getScriptProperties().getProperty(
    'SHEETS_API_TOKEN'
  );
  if (tokenExpected) {
    if (String(params.token || '') !== String(tokenExpected)) {
      return jsonOutput_({ error: 'unauthorized' });
    }
  }

  var term = String(params.term || '2271');
  var coursesParam = String(params.courses || '');
  var courses = coursesParam
    ? coursesParam.split(',').map(function (c) {
        return c.replace(/\+/g, ' ').trim();
      })
    : [];

  var cache = CacheService.getScriptCache();
  var cacheKey = 'fmc2:' + term + ':' + courses.join('|');
  var cached = cache.get(cacheKey);
  if (cached) {
    var parsed = JSON.parse(cached);
    parsed.source = 'cache';
    return jsonOutput_(parsed);
  }

  var payload = buildApiPayload_(term, courses);
  payload.cachedAt = new Date().toISOString();
  payload.source = 'live';
  try {
    cache.put(cacheKey, JSON.stringify(payload), FMC.CACHE_SECONDS);
  } catch (err) {
    Logger.log('Cache put skipped: %s', err);
  }
  return jsonOutput_(payload);
}

function buildApiPayload_(term, courses) {
  var tabName = fmcTabForTerm_(term);
  if (!tabName) {
    return {
      term: term,
      courses: courses,
      sections: [],
      error: 'unknown_term',
      knownTerms: Object.keys(FMC.TERMS)
    };
  }

  var ss = fmcSpreadsheet_();
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    return {
      term: term,
      courses: courses,
      sections: [],
      error: 'missing_tab',
      tab: tabName
    };
  }

  var wanted = {};
  courses.forEach(function (c) {
    wanted[c.toUpperCase().replace(/\s+/g, ' ')] = true;
  });
  var filterCourses = courses.length > 0;

  var sections = loadMappedSections_(sheet).filter(function (s) {
    if (String(s.term_code) !== String(term)) return false;
    if (!filterCourses) return true;
    return wanted[String(s.course_code).toUpperCase().replace(/\s+/g, ' ')];
  });

  return {
    term: term,
    courses: courses,
    tab: tabName,
    sections: sections
  };
}

function loadMappedSections_(sheet) {
  var headers = fmcHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  var headerKeys = Object.keys(FMC.COLUMN_MAP);
  var out = [];

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var raw = {};
    for (var h = 0; h < headerKeys.length; h++) {
      var human = headerKeys[h];
      var field = FMC.COLUMN_MAP[human];
      var idx = headers[human];
      if (idx == null) continue;
      raw[field] = row[idx];
    }

    var courseCode = String(raw.course_code || '').trim();
    var classNbr = String(raw.class_nbr == null ? '' : raw.class_nbr).trim();
    if (!courseCode && !classNbr) continue;

    var times = fmcParseTimes_(raw.times_raw);
    var catalog = fmcCatalogFromCourse_(courseCode);
    var instructor = String(raw.instructor || '').trim() || 'Staff';
    var staffTba =
      fmcIsTruthyStaff_(raw.staff_tba_raw) || fmcIsStaffName_(instructor);
    var inferredRaw = String(raw.inferred_instructor_raw || '').trim();
    var inferredPrimary = fmcPrimaryInferred_(inferredRaw);

    var section = {
      term_code: String(raw.term_code || '').trim(),
      term: String(raw.term || '').trim(),
      subject: String(raw.subject || catalog.subject || '').trim(),
      catalog_nbr: catalog.catalog_nbr,
      course_code: courseCode,
      title: String(raw.title || '').trim(),
      section: String(raw.section || '').trim(),
      class_nbr: classNbr,
      component: String(raw.component || '').trim(),
      instruction_mode: String(raw.instruction_mode || '').trim(),
      credits: raw.credits === '' || raw.credits == null ? '' : raw.credits,
      session: String(raw.session || '').trim(),
      days: String(raw.days || '').trim(),
      start_time: times.start_time,
      end_time: times.end_time,
      times_raw: times.times_raw,
      location: String(raw.location || '').trim(),
      campus: String(raw.campus || '').trim(),
      status: String(raw.status || '').trim(),
      seats_open: raw.seats_open,
      capacity: raw.capacity,
      enrolled: raw.enrolled,
      waitlist: raw.waitlist,
      waitlist_cap: raw.waitlist_cap,
      // Compatibility aliases used by older clients
      instructor: instructor,
      instructor_ctclink: instructor,
      instructor_override: '',
      effective_instructor: instructor,
      staff_tba: staffTba,
      rmp_match: String(raw.rmp_match || '').trim(),
      match_confidence: String(raw.match_confidence || '').trim(),
      match_note: String(raw.match_note || '').trim(),
      rmp_overall: blankToNull_(raw.rmp_overall),
      rmp_difficulty: blankToNull_(raw.rmp_difficulty),
      rmp_would_take_again: blankToNull_(raw.rmp_would_take_again),
      rmp_num_ratings: blankToNull_(raw.rmp_num_ratings),
      rmp_course_quality: blankToNull_(raw.rmp_course_quality),
      rmp_course_difficulty: blankToNull_(raw.rmp_course_difficulty),
      rmp_course_wta: blankToNull_(raw.rmp_course_wta),
      rmp_course_num_ratings: blankToNull_(raw.rmp_course_num_ratings),
      rmp_url: String(raw.rmp_url || '').trim(),
      inferred_instructor: inferredPrimary,
      inferred_instructor_raw: inferredRaw,
      inference_basis: String(raw.inference_basis || '').trim(),
      inferred_rmp_overall: blankToNull_(raw.inferred_rmp_overall),
      inferred_rmp_difficulty: blankToNull_(raw.inferred_rmp_difficulty),
      inferred_rmp_wta: blankToNull_(raw.inferred_rmp_wta),
      inferred_rmp_num_ratings: blankToNull_(raw.inferred_rmp_num_ratings),
      inferred_rmp_url: String(raw.inferred_rmp_url || '').trim(),
      other_inferred_candidates: String(
        raw.other_inferred_candidates || ''
      ).trim(),
      enroll_url: String(raw.enroll_url || '').trim(),
      details_link_check: String(raw.details_link_check || '').trim(),
      removed: false
    };

    section.rmp_confirmed = fmcConfirmedRmp_(section);
    out.push(section);
  }

  return out;
}

function blankToNull_(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number' && isNaN(v)) return null;
  return v;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/* ===== Menu.gs ===== */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Planner')
    .addItem('Clear API cache', 'ClearFmcCache')
    .addSeparator()
    .addItem('Sync sections (stub)', 'SyncSections')
    .addItem('Sync RateMyProfessors (stub)', 'SyncRmp')
    .addItem('Recompute rankings (stub)', 'RecomputeRankings')
    .addToUi();
}

function ClearFmcCache() {
  // CacheService has no enumerate API; entries expire via TTL (FMC.CACHE_SECONDS).
  // Touch a sentinel key so operators know clear was invoked.
  var cache = CacheService.getScriptCache();
  cache.remove('fmc2:__clear__');
  cache.put('fmc2:__clear__', String(Date.now()), 60);
  SpreadsheetApp.getUi().alert(
    'API cache entries expire automatically (~' +
      Math.round(FMC.CACHE_SECONDS / 60) +
      ' minutes). Redeploy or wait for TTL after sheet edits.'
  );
}

/* ===== SyncSections.gs ===== */
/**
 * Stub — term tabs are already populated externally.
 * Kept so old Planner menu / triggers do not break.
 */
function SyncSections() {
  SpreadsheetApp.getUi().alert(
    'SyncSections is disabled. This spreadsheet is already populated; ' +
      'Apps Script only serves JSON via doGet. Update the Winter/Spring tabs directly.'
  );
}

/* ===== SyncRmp.gs ===== */
/**
 * Stub — RMP columns live on each term tab.
 */
function SyncRmp() {
  SpreadsheetApp.getUi().alert(
    'SyncRmp is disabled. RMP fields are already on the term tabs; ' +
      'Apps Script is a read-only API bridge.'
  );
}

/* ===== Rankings.gs ===== */
/**
 * Stub — personal ranking happens in the Next.js app from section RMP fields.
 */
function RecomputeRankings() {
  SpreadsheetApp.getUi().alert(
    'RecomputeRankings is disabled. There is no Rankings tab; ' +
      'the web app re-ranks using RMP columns on each section row.'
  );
}

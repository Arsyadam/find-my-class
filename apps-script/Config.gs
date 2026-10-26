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

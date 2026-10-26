/**
 * Find My Class — Apps Script config
 * Spreadsheet SoT: keep existing headers; may ADD columns (e.g. removed).
 */
var FMC = {
  SHEET_ID: '1bvZht035ZNWhicZw5ozdQ9LzbCvJ95H0ynaGMxQqf1g',
  TABS: {
    SECTIONS: 'Sections',
    PROFESSORS: 'Professors',
    COURSE_STATS: 'CourseStats',
    ALIASES: 'Aliases',
    RANKINGS: 'Rankings',
    README: 'README'
  },
  TERMS: {
    '2271': 'Winter 2027',
    '2273': 'Spring 2027'
  },
  // Common GRC subjects to scan (extend as needed)
  SUBJECTS: [
    'ENGL', 'MATH', 'CHEM', 'PHYS', 'ENGR', 'POLS', 'CMST', 'BIOL',
    'CS', 'CS&', 'PSYC', 'HIST', 'PHIL', 'ECON', 'GEOL', 'ASTR'
  ],
  CLASS_SEARCH:
    'https://csprd.ctclink.us/psc/csprd/EMPLOYEE/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch',
  INSTITUTION: 'WA100',
  RMP_SCHOOL_ID: 'U2Nob29sLTIxMjM=',
  RMP_LEGACY_ID: '2123',
  CACHE_SECONDS: 600,
  STAFF_PENALTY: 25
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

function fmcEnsureColumn_(sheet, name) {
  var headers = fmcHeaders_(sheet);
  if (headers[name] != null) return headers;
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(name);
  return fmcHeaders_(sheet);
}

function fmcEffectiveInstructor_(override, ctclink) {
  var o = (override || '').toString().trim();
  if (o) return o;
  var c = (ctclink || '').toString().trim();
  return c || 'Staff';
}

function fmcNormalizeNameKey_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Last, First ↔ First Last equivalence without a private FRIEND dict */
function fmcNamesMatch_(a, b) {
  var ka = fmcNormalizeNameKey_(a);
  var kb = fmcNormalizeNameKey_(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  var pa = ka.split(' ').filter(Boolean);
  var pb = kb.split(' ').filter(Boolean);
  if (pa.length >= 2 && pb.length >= 2) {
    var revA = pa.slice(1).join(' ') + ' ' + pa[0];
    var revB = pb.slice(1).join(' ') + ' ' + pb[0];
    if (revA === kb || revB === ka || revA === revB) return true;
  }
  return false;
}

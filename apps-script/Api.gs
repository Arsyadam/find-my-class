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

  var sections = loadMappedSections_(sheet, term, filterCourses ? wanted : null);

  return {
    term: term,
    courses: courses,
    tab: tabName,
    sections: sections
  };
}

function loadMappedSections_(sheet, term, wantedCourses) {
  var headers = fmcHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  var headerKeys = Object.keys(FMC.COLUMN_MAP);
  var courseCol = headers['Course'];
  var out = [];

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    // Fast path: skip empty / other courses before full column map
    if (courseCol != null) {
      var quickCourse = String(row[courseCol] || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
      if (!quickCourse) continue;
      if (wantedCourses && !wantedCourses[quickCourse]) continue;
    }

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

    if (term && String(section.term_code) !== String(term)) continue;
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

/**
 * Web app entry: ?term=2271&courses=ENGL%20128,CHEM%26%20161&token=...
 * Cached via CacheService for FMC.CACHE_SECONDS.
 */
function doGet(e) {
  e = e || { parameter: {} };
  var params = e.parameter || {};
  var tokenExpected = PropertiesService.getScriptProperties().getProperty('SHEETS_API_TOKEN');
  if (tokenExpected) {
    if (String(params.token || '') !== String(tokenExpected)) {
      return jsonOutput_({ error: 'unauthorized' }, 401);
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
  var cacheKey = 'fmc:' + term + ':' + courses.join('|');
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
    // Cache value may exceed 100KB; ignore
    Logger.log('Cache put skipped: %s', err);
  }
  return jsonOutput_(payload);
}

function buildApiPayload_(term, courses) {
  var ss = fmcSpreadsheet_();
  var wanted = {};
  courses.forEach(function (c) {
    wanted[c.toUpperCase().replace(/\s+/g, ' ')] = true;
  });
  var filterCourses = courses.length > 0;

  function load(tab) {
    var sheet = ss.getSheetByName(tab);
    if (!sheet) return [];
    return sheetObjects_(sheet, fmcHeaders_(sheet));
  }

  var sections = load(FMC.TABS.SECTIONS).filter(function (s) {
    if (String(s.term_code) !== String(term)) return false;
    if (s.removed === true || String(s.removed).toUpperCase() === 'TRUE') return false;
    if (!filterCourses) return true;
    return wanted[String(s.course_code).toUpperCase().replace(/\s+/g, ' ')];
  });

  var rankings = load(FMC.TABS.RANKINGS).filter(function (r) {
    if (String(r.term_code) !== String(term)) return false;
    if (!filterCourses) return true;
    return wanted[String(r.course_code).toUpperCase().replace(/\s+/g, ' ')];
  });

  var professors = load(FMC.TABS.PROFESSORS);
  var courseStats = load(FMC.TABS.COURSE_STATS);

  return {
    term: term,
    courses: courses,
    sections: sections,
    professors: professors,
    courseStats: courseStats,
    rankings: rankings
  };
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

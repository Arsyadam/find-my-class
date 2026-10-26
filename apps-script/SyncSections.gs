/**
 * Upsert ctcLink ClassSearch rows into Sections.
 * Never overwrite instructor_override. Mark missing as removed=TRUE (do not delete).
 */
function SyncSections() {
  var ss = fmcSpreadsheet_();
  var sheet = ss.getSheetByName(FMC.TABS.SECTIONS);
  if (!sheet) throw new Error('Missing Sections tab');
  var headers = fmcEnsureColumn_(sheet, 'removed');

  Object.keys(FMC.TERMS).forEach(function (termCode) {
    FMC.SUBJECTS.forEach(function (subject) {
      syncSubjectTerm_(sheet, headers, termCode, subject);
    });
  });

  SpreadsheetApp.flush();
  Logger.log('SyncSections complete');
}

function syncSubjectTerm_(sheet, headers, termCode, subject) {
  var page = 1;
  var pageCount = 1;
  var seen = {};
  var cookie = '';

  while (page <= pageCount) {
    var url =
      FMC.CLASS_SEARCH +
      '?institution=' +
      encodeURIComponent(FMC.INSTITUTION) +
      '&term=' +
      encodeURIComponent(termCode) +
      '&subject=' +
      encodeURIComponent(subject) +
      '&page=' +
      page;

    var params = {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: cookie ? { Cookie: cookie } : {}
    };
    var res = UrlFetchApp.fetch(url, params);
    var setCookie = res.getAllHeaders()['Set-Cookie'] || res.getAllHeaders()['set-cookie'];
    if (setCookie && !cookie) {
      cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
      // Retry first page with cookie if needed
      if (page === 1 && res.getResponseCode() >= 400) {
        params.headers = { Cookie: cookie };
        res = UrlFetchApp.fetch(url, params);
      }
    }

    var text = res.getContentText();
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      Logger.log('Non-JSON for %s %s page %s: %s', termCode, subject, page, text.slice(0, 120));
      return;
    }

    pageCount = Number(data.pageCount || data.page_count || 1) || 1;
    var classes = data.classes || data.classSearchResults || data || [];
    if (!Array.isArray(classes)) classes = [];

    classes.forEach(function (row) {
      upsertSectionRow_(sheet, headers, termCode, row, seen);
    });

    page += 1;
    Utilities.sleep(250);
  }

  // Mark rows for this term+subject not seen as removed
  markMissingRemoved_(sheet, headers, termCode, subject, seen);
}

function upsertSectionRow_(sheet, headers, termCode, row, seen) {
  var classNbr = String(row.class_nbr || row.classNbr || row.CLASS_NBR || '');
  if (!classNbr) return;
  seen[classNbr] = true;

  var subject = String(row.subject || row.SUBJECT || '');
  var catalog = String(row.catalog_nbr || row.catalogNbr || row.CATALOG_NBR || '');
  var courseCode = (subject + ' ' + catalog).replace(/\s+/g, ' ').trim();
  var ctclinkInstructor = String(
    row.instructors
      ? (Array.isArray(row.instructors)
          ? (row.instructors[0] && (row.instructors[0].name || row.instructors[0].displayName)) || ''
          : row.instructors)
      : row.instructor || row.INSTRUCTOR || ''
  );

  var enrollUrl = buildEnrollUrl_(termCode, classNbr);
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var existing = findSectionRow_(sheet, headers, termCode, classNbr);

  var values = [];
  // Build full row aligned to headers
  var map = {
    term_code: termCode,
    term: FMC.TERMS[termCode] || termCode,
    subject: subject,
    catalog_nbr: catalog,
    course_code: courseCode,
    title: row.class_title || row.title || row.COURSE_TITLE_LONG || '',
    section: row.class_section || row.section || row.CLASS_SECTION || '',
    class_nbr: classNbr,
    component: row.component || row.SSR_COMPONENT || '',
    instruction_mode: row.instruction_mode || row.INSTRUCTION_MODE || '',
    credits: row.units || row.credits || row.UNITS || '',
    days: extractMeeting_(row, 'days'),
    start_time: extractMeeting_(row, 'start'),
    end_time: extractMeeting_(row, 'end'),
    location: extractMeeting_(row, 'location'),
    status: row.status || row.STATUS || '',
    seats_open: row.seats_open != null ? row.seats_open : (row.enrollment_available || ''),
    capacity: row.capacity || row.class_capacity || '',
    waitlist: row.waitlist || row.wait_total || '',
    instructor_ctclink: ctclinkInstructor,
    enroll_url: enrollUrl,
    last_synced: new Date().toISOString(),
    removed: false
  };

  if (existing) {
    var override = sheet.getRange(existing, headers.instructor_override + 1).getValue();
    map.instructor_override = override;
    map.effective_instructor = fmcEffectiveInstructor_(override, ctclinkInstructor);
    // Write only non-override columns
    Object.keys(map).forEach(function (key) {
      if (key === 'instructor_override') return;
      if (headers[key] == null) return;
      sheet.getRange(existing, headers[key] + 1).setValue(map[key]);
    });
  } else {
    map.instructor_override = '';
    map.effective_instructor = fmcEffectiveInstructor_('', ctclinkInstructor);
    var rowVals = [];
    for (var c = 0; c < lastCol; c++) rowVals.push('');
    Object.keys(headers).forEach(function (key) {
      if (map[key] != null) rowVals[headers[key]] = map[key];
    });
    sheet.appendRow(rowVals);
  }
}

function findSectionRow_(sheet, headers, termCode, classNbr) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var termIdx = headers.term_code;
  var nbrIdx = headers.class_nbr;
  if (termIdx == null || nbrIdx == null) return null;
  var data = sheet.getRange(2, 1, lastRow, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][termIdx]) === String(termCode) && String(data[i][nbrIdx]) === String(classNbr)) {
      return i + 2;
    }
  }
  return null;
}

function markMissingRemoved_(sheet, headers, termCode, subject, seen) {
  if (headers.removed == null) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[headers.term_code]) !== String(termCode)) continue;
    if (String(row[headers.subject]) !== String(subject)) continue;
    var nbr = String(row[headers.class_nbr]);
    if (!seen[nbr]) {
      sheet.getRange(i + 2, headers.removed + 1).setValue(true);
    }
  }
}

function extractMeeting_(row, kind) {
  var meetings = row.meetings || row.meetingTimes || row.classMeetings || [];
  if (!Array.isArray(meetings) || !meetings.length) {
    if (kind === 'days') return row.days || row.DAYS || 'TBA';
    if (kind === 'start') return row.start_time || row.START_TIME || 'TBA';
    if (kind === 'end') return row.end_time || row.END_TIME || 'TBA';
    return row.location || row.LOCATION || '';
  }
  var m = meetings[0];
  if (kind === 'days') return m.days || m.DAY || 'TBA';
  if (kind === 'start') return m.start_time || m.start || m.START_TIME || 'TBA';
  if (kind === 'end') return m.end_time || m.end || m.END_TIME || 'TBA';
  return m.location || m.bldg || m.facility || '';
}

function buildEnrollUrl_(termCode, classNbr) {
  // Prefer a Class Information-style deep link; ctcLink often still requires login.
  return (
    'https://csprd.ctclink.us/psc/csprd/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL' +
    '?term=' +
    encodeURIComponent(termCode) +
    '&class_nbr=' +
    encodeURIComponent(classNbr)
  );
}

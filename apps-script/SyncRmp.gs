/**
 * Sync RateMyProfessors data for GRC (school id U2Nob29sLTIxMjM= / 2123).
 * Resolves names via Aliases tab, then Last,First ↔ First Last matching.
 * RMP GraphQL endpoints change; this uses UrlFetch with best-effort parsing
 * and leaves existing rows intact on failure.
 */
function SyncRmp() {
  var ss = fmcSpreadsheet_();
  var profSheet = ss.getSheetByName(FMC.TABS.PROFESSORS);
  var aliasSheet = ss.getSheetByName(FMC.TABS.ALIASES);
  var sections = ss.getSheetByName(FMC.TABS.SECTIONS);
  if (!profSheet || !sections) throw new Error('Missing Professors or Sections tab');

  var aliases = loadAliases_(aliasSheet);
  var names = collectInstructorNames_(sections);
  names.forEach(function (name) {
    if (!name || /^staff$/i.test(name) || /^tba$/i.test(name)) return;
    var resolved = resolveAlias_(name, aliases) || name;
    upsertProfessorStub_(profSheet, resolved, name);
  });

  // Best-effort RMP search per professor without rmp_id
  enrichProfessorsFromRmp_(profSheet);
  Logger.log('SyncRmp complete');
}

function loadAliases_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = fmcHeaders_(sheet);
  var data = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  return data.map(function (row) {
    return {
      ctclink_name: row[headers.ctclink_name] || '',
      rmp_name: row[headers.rmp_name] || '',
      rmp_id: row[headers.rmp_id] || '',
      note: row[headers.note] || ''
    };
  });
}

function resolveAlias_(ctclinkName, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    if (fmcNamesMatch_(aliases[i].ctclink_name, ctclinkName)) {
      return aliases[i].rmp_name || aliases[i].ctclink_name;
    }
  }
  return null;
}

function collectInstructorNames_(sheet) {
  var headers = fmcHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow, sheet.getLastColumn()).getValues();
  var set = {};
  data.forEach(function (row) {
    var override = headers.instructor_override != null ? row[headers.instructor_override] : '';
    var ctclink = headers.instructor_ctclink != null ? row[headers.instructor_ctclink] : '';
    var name = fmcEffectiveInstructor_(override, ctclink);
    set[name] = true;
  });
  return Object.keys(set);
}

function upsertProfessorStub_(sheet, name, ctclinkName) {
  var headers = fmcHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  var found = null;
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow, sheet.getLastColumn()).getValues();
    for (var i = 0; i < data.length; i++) {
      if (fmcNamesMatch_(data[i][headers.name], name) || fmcNamesMatch_(data[i][headers.name], ctclinkName)) {
        found = i + 2;
        break;
      }
    }
  }
  if (found) return found;
  var row = [];
  for (var c = 0; c < sheet.getLastColumn(); c++) row.push('');
  if (headers.name != null) row[headers.name] = name;
  if (headers.last_synced != null) row[headers.last_synced] = new Date().toISOString();
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function enrichProfessorsFromRmp_(sheet) {
  var headers = fmcHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow, sheet.getLastColumn()).getValues();

  for (var i = 0; i < data.length; i++) {
    var name = data[i][headers.name];
    if (!name) continue;
    var existingId = headers.rmp_id != null ? data[i][headers.rmp_id] : '';
    try {
      var info = fetchRmpProfessor_(name, existingId);
      if (!info) continue;
      var rowNum = i + 2;
      if (headers.rmp_id != null && info.rmp_id) sheet.getRange(rowNum, headers.rmp_id + 1).setValue(info.rmp_id);
      if (headers.rmp_url != null && info.rmp_url) sheet.getRange(rowNum, headers.rmp_url + 1).setValue(info.rmp_url);
      if (headers.rating != null && info.rating != null) sheet.getRange(rowNum, headers.rating + 1).setValue(info.rating);
      if (headers.difficulty != null && info.difficulty != null) sheet.getRange(rowNum, headers.difficulty + 1).setValue(info.difficulty);
      if (headers.would_take_again != null && info.would_take_again != null) {
        sheet.getRange(rowNum, headers.would_take_again + 1).setValue(info.would_take_again);
      }
      if (headers.num_ratings != null && info.num_ratings != null) {
        sheet.getRange(rowNum, headers.num_ratings + 1).setValue(info.num_ratings);
      }
      if (headers.department != null && info.department) {
        sheet.getRange(rowNum, headers.department + 1).setValue(info.department);
      }
      if (headers.last_synced != null) {
        sheet.getRange(rowNum, headers.last_synced + 1).setValue(new Date().toISOString());
      }
      Utilities.sleep(300);
    } catch (e) {
      Logger.log('RMP enrich failed for %s: %s', name, e);
    }
  }
}

/**
 * Best-effort RMP lookup. Public HTML/search is brittle; store URL pattern when id known.
 */
function fetchRmpProfessor_(name, existingId) {
  if (existingId) {
    return {
      rmp_id: String(existingId),
      rmp_url: 'https://www.ratemyprofessors.com/professor/' + existingId
    };
  }

  // GraphQL teacher search (may require updates if RMP changes schema)
  var query = {
    query:
      'query TeacherSearchResultsPageQuery($query: TeacherSearchQuery!) { newSearch { teachers(query: $query) { edges { node { id legacyId firstName lastName avgRating avgDifficulty wouldTakeAgainPercent numRatings department } } } } }',
    variables: {
      query: {
        text: name,
        schoolID: FMC.RMP_SCHOOL_ID,
        fallback: true
      }
    }
  };

  var res = UrlFetchApp.fetch('https://www.ratemyprofessors.com/graphql', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(query),
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Basic dGVzdDp0ZXN0'
    }
  });

  if (res.getResponseCode() >= 400) {
    Logger.log('RMP HTTP %s for %s', res.getResponseCode(), name);
    return null;
  }

  var json = JSON.parse(res.getContentText());
  var edges =
    (((json.data || {}).newSearch || {}).teachers || {}).edges || [];
  if (!edges.length) return null;

  var node = edges[0].node;
  var legacyId = node.legacyId || '';
  return {
    rmp_id: String(legacyId),
    rmp_url: legacyId
      ? 'https://www.ratemyprofessors.com/professor/' + legacyId
      : '',
    rating: node.avgRating,
    difficulty: node.avgDifficulty,
    would_take_again: node.wouldTakeAgainPercent,
    num_ratings: node.numRatings,
    department: node.department || ''
  };
}

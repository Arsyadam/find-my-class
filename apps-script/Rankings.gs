/**
 * Recompute Rankings tab: per term_code + course_code, score sections using
 * RMP + CourseStats. Staff/TBA without override rank below known instructors.
 */
function RecomputeRankings() {
  var ss = fmcSpreadsheet_();
  var sections = ss.getSheetByName(FMC.TABS.SECTIONS);
  var professors = ss.getSheetByName(FMC.TABS.PROFESSORS);
  var courseStats = ss.getSheetByName(FMC.TABS.COURSE_STATS);
  var rankings = ss.getSheetByName(FMC.TABS.RANKINGS);
  if (!sections || !rankings) throw new Error('Missing Sections or Rankings tab');

  var secHeaders = fmcHeaders_(sections);
  var profHeaders = professors ? fmcHeaders_(professors) : {};
  var statHeaders = courseStats ? fmcHeaders_(courseStats) : {};

  var secRows = sheetObjects_(sections, secHeaders);
  var profRows = professors ? sheetObjects_(professors, profHeaders) : [];
  var statRows = courseStats ? sheetObjects_(courseStats, statHeaders) : [];

  // Clear data rows but keep header
  if (rankings.getLastRow() > 1) {
    rankings.getRange(2, 1, rankings.getLastRow(), rankings.getLastColumn()).clearContent();
  }
  var rankHeaders = fmcHeaders_(rankings);

  var groups = {};
  secRows.forEach(function (s) {
    if (s.removed === true || String(s.removed).toUpperCase() === 'TRUE') return;
    var key = String(s.term_code) + '||' + String(s.course_code);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  var out = [];
  Object.keys(groups).forEach(function (key) {
    var list = groups[key].map(function (s) {
      return scoreSection_(s, profRows, statRows);
    });
    list.sort(function (a, b) {
      return b.score - a.score;
    });
    list.forEach(function (item, idx) {
      var rank = idx + 1;
      out.push({
        term_code: item.section.term_code,
        course_code: item.section.course_code,
        rank: rank,
        rank_label: rank === 1 ? '1st option' : rank === 2 ? '2nd option' : rank === 3 ? '3rd option' : rank + 'th option',
        class_nbr: item.section.class_nbr,
        section: item.section.section,
        professor: item.professor,
        score: item.score,
        reason: item.reason,
        enroll_url: item.section.enroll_url || '',
        rmp_url: item.rmp_url || '',
        computed_at: new Date().toISOString()
      });
    });
  });

  out.forEach(function (row) {
    var vals = [];
    for (var c = 0; c < rankings.getLastColumn(); c++) vals.push('');
    Object.keys(rankHeaders).forEach(function (h) {
      if (row[h] != null) vals[rankHeaders[h]] = row[h];
    });
    rankings.appendRow(vals);
  });

  Logger.log('RecomputeRankings wrote %s rows', out.length);
}

function sheetObjects_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow, sheet.getLastColumn()).getValues();
  return data.map(function (row) {
    var obj = {};
    Object.keys(headers).forEach(function (h) {
      obj[h] = row[headers[h]];
    });
    return obj;
  });
}

function scoreSection_(section, professors, stats) {
  var professor = fmcEffectiveInstructor_(
    section.instructor_override,
    section.instructor_ctclink
  );
  var prof = null;
  for (var i = 0; i < professors.length; i++) {
    if (fmcNamesMatch_(professors[i].name, professor)) {
      prof = professors[i];
      break;
    }
  }
  var courseStat = null;
  for (var j = 0; j < stats.length; j++) {
    if (
      String(stats[j].course_code).toUpperCase() === String(section.course_code).toUpperCase() &&
      fmcNamesMatch_(stats[j].professor, professor)
    ) {
      courseStat = stats[j];
      break;
    }
  }

  var quality = Number(
    (courseStat && courseStat.course_quality) ||
      (courseStat && courseStat.overall_rating) ||
      (prof && prof.rating) ||
      0
  );
  var difficulty = Number(
    (courseStat && courseStat.course_difficulty) ||
      (courseStat && courseStat.overall_difficulty) ||
      (prof && prof.difficulty) ||
      3
  );
  var wta = Number(
    (courseStat && courseStat.course_would_take_again_pct) ||
      (courseStat && courseStat.overall_would_take_again_pct) ||
      (prof && prof.would_take_again) ||
      0
  );
  if (wta > 5) wta = wta / 20; // rough 0-5
  else wta = wta;

  var easiness = Math.max(0, 5 - difficulty);
  var score = quality * 12 + easiness * 6 + wta * 6;

  var reasons = [];
  if (courseStat && Number(courseStat.course_num_ratings) > 0) {
    reasons.push('course-specific RMP');
  } else if (prof && Number(prof.rating) > 0) {
    reasons.push('overall RMP ' + Number(prof.rating).toFixed(1));
  }
  if (Number(section.seats_open) > 0) reasons.push('seats open');
  if (Number(section.seats_open) <= 0) {
    score -= 10;
    reasons.push('full/closed');
  }

  if (/^staff$/i.test(professor) || /^tba$/i.test(professor)) {
    score -= FMC.STAFF_PENALTY;
    reasons.push('Staff/TBA below known instructors');
  }

  return {
    section: section,
    professor: professor,
    score: Math.round(score * 10) / 10,
    reason: reasons.slice(0, 3).join(' · ') || 'Base score',
    rmp_url: (prof && prof.rmp_url) || (courseStat && courseStat.rmp_url) || ''
  };
}

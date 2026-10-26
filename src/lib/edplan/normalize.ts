export interface NormalizedCourse {
  rawTitle: string;
  courseCode: string | null;
  subject: string | null;
  catalogNbr: string | null;
  needsChoice: boolean;
  notes: string[];
}

const PLACEHOLDER_PATTERNS = [
  /^humanities\b/i,
  /^social\s*science/i,
  /^humanities\s*\/\s*social/i,
  /^elective/i,
  /^transfer\b/i,
  /^vacation$/i,
  /^apply\b/i,
  /^ip\s*\d*$/i,
  /^tbd$/i,
  /^tba$/i,
  /^choice$/i,
];

/** Match ctcLink-ish codes: ENGL 128, MATH& 152, CHEM&/161, POLS& 202 (ss) */
const COURSE_RE =
  /^([A-Z]{2,6}&?)[\s\/\-]*(\d{2,4}[A-Z]?)(?:\s*[(\[].*)?/i;

export function normalizeCourseTitle(raw: string): NormalizedCourse {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  const notes: string[] = [];

  if (!trimmed) {
    return {
      rawTitle: raw,
      courseCode: null,
      subject: null,
      catalogNbr: null,
      needsChoice: true,
      notes: ["empty"],
    };
  }

  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(lower))) {
    return {
      rawTitle: trimmed,
      courseCode: null,
      subject: null,
      catalogNbr: null,
      needsChoice: true,
      notes: ["placeholder — pick a specific course"],
    };
  }

  // Strip trailing mode hints like "online"
  let working = trimmed;
  if (/\bonline\b/i.test(working)) {
    notes.push("edplan noted online");
    working = working.replace(/\bonline\b/gi, "").trim();
  }

  // Drop parenthetical distribution tags: (ss), (hum), (some schools)
  working = working.replace(/\s*\([^)]*\)\s*$/g, "").trim();

  const match = working.match(COURSE_RE);
  if (!match) {
    return {
      rawTitle: trimmed,
      courseCode: null,
      subject: null,
      catalogNbr: null,
      needsChoice: true,
      notes: ["unrecognized title — choose a ctcLink course code"],
    };
  }

  let subject = match[1].toUpperCase();
  const catalogNbr = match[2].toUpperCase();

  // Normalize ENGL&/101 and ENGL & 101 → keep & attached to subject when present
  subject = subject.replace(/&$/, "") + (match[1].includes("&") ? "&" : "");
  // Fix double-amp from odd inputs
  subject = subject.replace(/&&+/g, "&");

  // Common GRC common-course numbering: keep & when original had it or slash form ENGL&/101
  if (/&?\//.test(trimmed) && !subject.endsWith("&")) {
    // ENGL&/101 style already handled; bare ENGL/101 is rare
  }

  // Re-read ampersand from original token
  const subjectToken = trimmed.match(/^([A-Za-z]{2,6}&?)/);
  if (subjectToken) {
    subject = subjectToken[1].toUpperCase();
    if (!subject.endsWith("&") && /&/.test(trimmed.slice(0, subject.length + 2))) {
      subject = `${subject.replace(/&/g, "")}&`;
    }
  }

  // Canonical: SUBJECT[&] + space + number (ctcLink form)
  const amp = subject.includes("&");
  const base = subject.replace(/&/g, "");
  const canonicalSubject = amp ? `${base}&` : base;
  const courseCode = `${canonicalSubject} ${catalogNbr}`;

  return {
    rawTitle: trimmed,
    courseCode,
    subject: canonicalSubject,
    catalogNbr,
    needsChoice: false,
    notes,
  };
}

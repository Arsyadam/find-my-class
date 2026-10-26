/** Parse "9:00 AM", "09:00", "1330", "TBA" → minutes from midnight or null */
export function timeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || /^tba$/i.test(s) || /^arr$/i.test(s)) return null;

  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const ap = ampm[3].toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }

  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  const compact = s.match(/^(\d{3,4})$/);
  if (compact) {
    const n = compact[1].padStart(4, "0");
    return Number(n.slice(0, 2)) * 60 + Number(n.slice(2));
  }

  return null;
}

/**
 * Expand day codes from new sheet (MoWe, TuTh, MoTuWeThFr, "TuFr; Mo")
 * and legacy compact forms (MW, TTh, MTWThF).
 */
export function expandDays(days: string | null | undefined): string[] {
  if (!days) return [];
  const raw = days.trim();
  if (!raw || /^tba$/i.test(raw) || /^arr$/i.test(raw)) return [];

  // Multi-meeting: "TuFr; Mo" → join tokens
  const chunks = raw.split(/[;/]+/).map((c) => c.trim()).filter(Boolean);
  const out: string[] = [];
  for (const chunk of chunks) {
    for (const d of expandDayChunk(chunk)) {
      if (!out.includes(d)) out.push(d);
    }
  }
  return out;
}

function expandDayChunk(chunk: string): string[] {
  const s = chunk.replace(/\s+/g, "");
  if (!s) return [];

  // Prefer two-letter tokens used by the new sheet
  const twoLetter = s.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)+$/i);
  if (twoLetter) {
    const out: string[] = [];
    const re = /Mo|Tu|We|Th|Fr|Sa|Su/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      out.push(normalizeDayToken(m[0]));
    }
    return out;
  }

  // Legacy MTWThF / MW / TTh
  const upper = s.toUpperCase();
  const out: string[] = [];
  let i = 0;
  while (i < upper.length) {
    if (upper.startsWith("TH", i)) {
      out.push("Th");
      i += 2;
    } else if (upper.startsWith("SU", i)) {
      out.push("Su");
      i += 2;
    } else if (upper.startsWith("SA", i)) {
      out.push("Sa");
      i += 2;
    } else {
      const ch = upper[i];
      if (ch === "M") out.push("M");
      else if (ch === "T") out.push("T");
      else if (ch === "W") out.push("W");
      else if (ch === "F") out.push("F");
      else if (ch === "S") out.push("Sa");
      i += 1;
    }
  }
  return out;
}

function normalizeDayToken(tok: string): string {
  switch (tok.toLowerCase()) {
    case "mo":
      return "M";
    case "tu":
      return "T";
    case "we":
      return "W";
    case "th":
      return "Th";
    case "fr":
      return "F";
    case "sa":
      return "Sa";
    case "su":
      return "Su";
    default:
      return tok;
  }
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

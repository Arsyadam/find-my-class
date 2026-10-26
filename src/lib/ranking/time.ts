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

export function expandDays(days: string | null | undefined): string[] {
  if (!days) return [];
  const s = days.trim().toUpperCase().replace(/\s+/g, "");
  if (!s || s === "TBA" || s === "ARR") return [];

  // MTWThF / MW / TTh etc.
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("TH", i)) {
      out.push("Th");
      i += 2;
    } else if (s.startsWith("SU", i)) {
      out.push("Su");
      i += 2;
    } else if (s.startsWith("SA", i)) {
      out.push("Sa");
      i += 2;
    } else {
      const ch = s[i];
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

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

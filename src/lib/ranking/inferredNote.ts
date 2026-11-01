/** Short user-facing note for Staff/TBA rows with an unconfirmed inferred instructor. */
export function inferredStaffNote(name: string): string {
  const clean = name.trim();
  if (!clean) return "Listed as Staff.";
  return `Listed as Staff. Likely: ${clean} (unconfirmed).`;
}

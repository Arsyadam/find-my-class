"use client";

import type { PlannedCourse } from "@/lib/edplan";
import { cn } from "@/lib/utils";

type Props = {
  termLabel: string;
  rows: PlannedCourse[];
  onChange: (rows: PlannedCourse[]) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function ReviewStep({
  termLabel,
  rows,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const ready = rows.some((r) => r.courseCode && !r.needsChoice);

  function updateCode(idx: number, value: string) {
    onChange(
      rows.map((r, i) =>
        i === idx
          ? {
              ...r,
              courseCode: value || null,
              needsChoice: !value.trim(),
            }
          : r,
      ),
    );
  }

  function addRow() {
    if (rows.length >= 4) return;
    onChange([
      ...rows,
      {
        rawTitle: "",
        courseCode: "",
        subject: null,
        catalogNbr: null,
        credits: null,
        needsChoice: true,
        notes: [],
        termCode: rows[0]?.termCode ?? "2271",
        termLabel,
        row: rows.length + 1,
      },
    ]);
  }

  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  return (
    <section className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Review courses
        </h1>
        <p className="text-muted-foreground">
          Confirm or edit up to four course codes for {termLabel}.
        </p>
      </header>

      <ul className="space-y-3">
        {rows.map((row, idx) => (
          <li
            key={`${row.row}-${idx}`}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              {row.rawTitle ? (
                <p className="truncate text-sm text-muted-foreground">{row.rawTitle}</p>
              ) : null}
              <input
                className="font-mono-course mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                value={row.courseCode ?? ""}
                placeholder="e.g. MATH& 152"
                onChange={(e) => updateCode(idx, e.target.value)}
              />
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                row.needsChoice || !row.courseCode
                  ? "text-amber-800"
                  : "text-primary",
              )}
            >
              {row.needsChoice || !row.courseCode ? "Needs code" : "Ready"}
            </span>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(idx)}
            >
              Remove
            </button>
          </li>
        ))}
        {!rows.length && (
          <li className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-muted-foreground">
            No courses yet — add up to four.
          </li>
        )}
      </ul>

      {rows.length < 4 && (
        <button
          type="button"
          onClick={addRow}
          className="self-start text-sm font-medium text-primary hover:underline"
        >
          + Add course
        </button>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={onContinue}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Continue to preferences
        </button>
      </div>
    </section>
  );
}

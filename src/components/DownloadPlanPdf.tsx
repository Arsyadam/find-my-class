"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Download } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BuiltSchedule, CourseRecommendation } from "@/lib/ranking";
import { cn } from "@/lib/utils";

type Props = {
  termLabel: string;
  courseCodes: string[];
  recommendations: CourseRecommendation[];
  schedule: BuiltSchedule | null;
  className?: string;
};

export function DownloadPlanPdf({
  termLabel,
  courseCodes,
  recommendations,
  schedule,
  className,
}: Props) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function download() {
    setBusy(true);
    try {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      let page = doc.addPage([612, 792]);
      let y = 750;
      const margin = 48;
      const ink = rgb(0.08, 0.13, 0.1);
      const mute = rgb(0.3, 0.36, 0.32);
      const green = rgb(0.12, 0.42, 0.29);

      const write = (
        text: string,
        opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {},
      ) => {
        const size = opts.size ?? 11;
        const f = opts.bold ? bold : font;
        const maxWidth = 612 - margin * 2;
        const words = text.split(/\s+/);
        let line = "";
        for (const word of words) {
          const trial = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(trial, size) > maxWidth) {
            if (y < 72) {
              page = doc.addPage([612, 792]);
              y = 750;
            }
            page.drawText(line, {
              x: opts.x ?? margin,
              y,
              size,
              font: f,
              color: opts.color ?? ink,
            });
            y -= size + 4;
            line = word;
          } else {
            line = trial;
          }
        }
        if (line) {
          if (y < 72) {
            page = doc.addPage([612, 792]);
            y = 750;
          }
          page.drawText(line, {
            x: opts.x ?? margin,
            y,
            size,
            font: f,
            color: opts.color ?? ink,
          });
          y -= size + 6;
        }
      };

      write("Plan Your Best Quarter in GRC", { size: 18, bold: true, color: green });
      write(termLabel, { size: 12, color: mute });
      write(`Courses: ${courseCodes.join(", ") || "—"}`, { size: 11 });
      y -= 8;

      for (const rec of recommendations) {
        write(rec.courseCode, { size: 13, bold: true });
        if (rec.message) write(rec.message, { size: 10, color: mute });
        if (!rec.options.length) {
          write("No ranked sections available.", { size: 10, color: mute });
        }
        for (const opt of rec.options) {
          write(
            `${opt.rankLabel} — Sec ${opt.section.section} (#${opt.section.class_nbr}) · ${opt.professorName}`,
            { size: 11, bold: true },
          );
          write(
            `${opt.section.days} ${opt.section.start_time}–${opt.section.end_time} · ${opt.section.instruction_mode} · ${opt.section.location || "—"}`,
            { size: 10, color: mute },
          );
          if (opt.rmpUrl) write(`RMP: ${opt.rmpUrl}`, { size: 9, color: mute });
          if (opt.enrollUrl) write(`Enroll: ${opt.enrollUrl}`, { size: 9, color: mute });
          y -= 4;
        }
        y -= 6;
      }

      if (schedule) {
        write("Conflict-free schedule", { size: 13, bold: true });
        write(`Total credits: ${schedule.totalCredits}`, { size: 10, color: mute });
        for (const b of schedule.blocks) {
          write(
            `${b.courseCode} sec ${b.section} — ${b.professor}: ${b.days} ${b.startTime}–${b.endTime} @ ${b.location}`,
            { size: 10 },
          );
        }
        if (schedule.unresolved.length) {
          write(`Could not place: ${schedule.unresolved.join(", ")}`, {
            size: 10,
            color: mute,
          });
        }
      }

      write(
        "Unofficial student tool — verify all sections in ctcLink before enrolling.",
        { size: 9, color: mute },
      );

      const bytes = await doc.save();
      const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `grc-plan-${termLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      window.setTimeout(() => setDone(false), 2200);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.button
      type="button"
      disabled={busy}
      onClick={() => void download()}
      whileHover={reduce ? undefined : { y: -1 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span
            key="ok"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="inline-flex items-center gap-2"
          >
            <Check className="size-4" />
            Saved
          </motion.span>
        ) : (
          <motion.span
            key="dl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="inline-flex items-center gap-2"
          >
            <Download className="size-4" />
            {busy ? "Building PDF…" : "Download plan PDF"}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BuiltSchedule, CourseRecommendation } from "@/lib/ranking";
import { DownloadPlanPdf } from "@/components/DownloadPlanPdf";
import { Disclaimer } from "@/components/Disclaimer";
import { cn } from "@/lib/utils";

type Props = {
  termLabel: string;
  courseCodes: string[];
  recommendations: CourseRecommendation[];
  schedule: BuiltSchedule | null;
  dataSource: string;
  onBack: () => void;
  onRestart: () => void;
};

export function ResultsStep({
  termLabel,
  courseCodes,
  recommendations,
  schedule,
  dataSource,
  onBack,
  onRestart,
}: Props) {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {termLabel} options
          </h1>
          <p className="text-sm text-muted-foreground">
            Data source: {dataSource || "unknown"}
          </p>
        </div>
        <DownloadPlanPdf
          termLabel={termLabel}
          courseCodes={courseCodes}
          recommendations={recommendations}
          schedule={schedule}
        />
      </header>

      <div className="space-y-6">
        {recommendations.map((rec, ri) => (
          <motion.article
            key={rec.courseCode}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { delay: ri * 0.04, type: "spring", stiffness: 280, damping: 28 }
            }
            className="space-y-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono-course text-xl font-semibold">
                {rec.courseCode}
              </h2>
              {rec.message && (
                <span className="text-sm text-amber-800">{rec.message}</span>
              )}
            </div>
            {!rec.options.length && (
              <p className="text-muted-foreground">No ranked sections available.</p>
            )}
            <div className="grid gap-3">
              {rec.options.map((opt, oi) => (
                <motion.div
                  key={`${opt.section.class_nbr}-${opt.rank}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          delay: ri * 0.04 + oi * 0.04,
                          type: "spring",
                          stiffness: 280,
                          damping: 28,
                        }
                  }
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <motion.span
                      initial={reduce ? false : { scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 380, damping: 18 }
                      }
                      className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                    >
                      {opt.rankLabel}
                    </motion.span>
                    <span className="font-medium">
                      Sec {opt.section.section} · #{opt.section.class_nbr}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      score {opt.score}
                    </span>
                  </div>
                  <dl className="grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="inline text-muted-foreground">Professor: </dt>
                      <dd className="inline">
                        {opt.professorName}
                        {opt.flags.inferred && opt.inferredInstructor
                          ? ` (likely: ${opt.inferredInstructor})`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Mode: </dt>
                      <dd className="inline">{opt.section.instruction_mode}</dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">When: </dt>
                      <dd className="inline">
                        {opt.section.days} {opt.section.start_time}–{opt.section.end_time}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Where: </dt>
                      <dd className="inline">{opt.section.location || "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Seats: </dt>
                      <dd className="inline">
                        {opt.section.seats_open}/{opt.section.capacity}
                        {Number(opt.section.waitlist) > 0
                          ? ` · WL ${opt.section.waitlist}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">RMP: </dt>
                      <dd className="inline">
                        {opt.rmp
                          ? `${opt.rmp.rating} / diff ${opt.rmp.difficulty} / WTA ${opt.rmp.would_take_again}`
                          : "n/a"}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-sm text-muted-foreground">{opt.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {opt.flags.tba && <Flag>TBA / ARR</Flag>}
                    {opt.flags.staff && <Flag>Staff/TBA</Flag>}
                    {opt.flags.inferred && <Flag>Inferred instructor</Flag>}
                    {opt.flags.full && <Flag>Full</Flag>}
                    {opt.flags.conflict && <Flag>Conflicts w/ 1st</Flag>}
                    {opt.flags.waitlist && <Flag>Waitlist</Flag>}
                    {opt.flags.notOffered && <Flag>Not offered</Flag>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {opt.rmpUrl && (
                      <a
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        href={opt.rmpUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        RateMyProfessors
                      </a>
                    )}
                    {opt.enrollUrl && (
                      <a
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        href={opt.enrollUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Enroll in ctcLink
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.article>
        ))}
      </div>

      {schedule && (
        <motion.article
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : { delay: 0.12, type: "spring", stiffness: 260, damping: 28 }
          }
          className="space-y-3 rounded-2xl border border-border bg-card p-5"
        >
          <h2 className="font-display text-xl font-semibold">
            Conflict-free schedule
          </h2>
          <p className="text-sm text-muted-foreground">
            Total credits: {schedule.totalCredits}
            {schedule.usedFallbacks.length
              ? ` · Fallbacks: ${schedule.usedFallbacks
                  .map((f) => `${f.courseCode}→${f.toRank}`)
                  .join(", ")}`
              : ""}
          </p>
          <ul className="space-y-2 text-sm">
            {schedule.blocks.map((b) => (
              <li
                key={`${b.courseCode}-${b.classNbr}`}
                className="rounded-xl bg-muted/70 px-3 py-2"
              >
                <strong className="font-mono-course">{b.courseCode}</strong> sec{" "}
                {b.section} (#{b.classNbr}) — {b.professor}: {b.days}{" "}
                {b.startTime}–{b.endTime} @ {b.location}{" "}
                <span className="text-muted-foreground">
                  (option {b.fallbackRank})
                </span>
              </li>
            ))}
          </ul>
          {schedule.unresolved.length > 0 && (
            <p className="text-sm text-amber-800">
              Could not place: {schedule.unresolved.join(", ")}
            </p>
          )}
        </motion.article>
      )}

      <Disclaimer />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Adjust preferences
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Start over
        </button>
      </div>
    </section>
  );
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900",
      )}
    >
      {children}
    </motion.span>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { PlannedCourse } from "@/lib/edplan";
import type { BuiltSchedule, CourseRecommendation, UserPreferences } from "@/lib/ranking";
import { Disclaimer } from "./Disclaimer";

type Step = "upload" | "plan" | "results";

const DAY_OPTIONS = ["M", "T", "W", "Th", "F"] as const;
const MODE_OPTIONS = ["In Person", "Online", "Hybrid"] as const;

const DEFAULT_PREFS: UserPreferences = {
  termCode: "2271",
  earliestTime: "08:00",
  latestTime: "21:00",
  preferDays: [],
  avoidDays: [],
  modes: [],
  maxCredits: 18,
  weightQuality: 55,
  weightEasiness: 20,
  weightWouldTakeAgain: 25,
};

export function PlannerApp() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState<Record<string, PlannedCourse[]>>({});
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [planRows, setPlanRows] = useState<PlannedCourse[]>([]);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [schedule, setSchedule] = useState<BuiltSchedule | null>(null);
  const [dataSource, setDataSource] = useState<string>("");

  const termLabel = prefs.termCode === "2273" ? "Spring 2027" : "Winter 2027";

  async function onUpload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/parse", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parse failed");
      setTerms(json.terms || {});
      const initialTerm = prefs.termCode;
      const rows: PlannedCourse[] = (json.terms?.[initialTerm] || []).map(
        (r: PlannedCourse) => ({ ...r }),
      );
      setPlanRows(rows);
      setStep("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function switchTerm(termCode: string) {
    setPrefs((p) => ({ ...p, termCode }));
    const rows = (terms[termCode] || []).map((r) => ({ ...r }));
    setPlanRows(rows);
  }

  async function onRecommend() {
    setError(null);
    setBusy(true);
    try {
      const courseCodes = planRows
        .filter((r) => r.courseCode && !r.needsChoice)
        .map((r) => r.courseCode as string);
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termCode: prefs.termCode,
          courseCodes,
          preferences: prefs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Recommend failed");
      setRecommendations(json.recommendations || []);
      setSchedule(json.schedule || null);
      setDataSource(json.source || "");
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recommend failed");
    } finally {
      setBusy(false);
    }
  }

  const needsChoiceCount = useMemo(
    () => planRows.filter((r) => r.needsChoice || !r.courseCode).length,
    [planRows],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Green River College · Auburn, WA
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
          Find My Class
        </h1>
        <p className="max-w-2xl text-lg text-[var(--muted)]">
          Upload your Educational Plan PDF, set schedule preferences, and get
          ranked 1st / 2nd / 3rd section options with a conflict-free weekly plan.
        </p>
        <Disclaimer />
      </header>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {(
          [
            ["upload", "1. Upload"],
            ["plan", "2. Plan & prefs"],
            ["results", "3. Results"],
          ] as const
        ).map(([id, label]) => (
          <span
            key={id}
            className={`rounded-full px-3 py-1 ${
              step === id
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            {label}
          </span>
        ))}
      </nav>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-900"
        >
          {error}
        </div>
      )}

      {step === "upload" && (
        <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            Educational Plan PDF
          </h2>
          <p className="text-[var(--muted)]">
            PDF only — screenshots and image exports are rejected. Files stay in
            memory for this request and are not saved to disk.
          </p>
          <label className="flex cursor-pointer flex-col items-start gap-3">
            <span className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-white">
              {busy ? "Parsing…" : "Choose PDF"}
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="text-sm"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
              }}
            />
          </label>
        </section>
      )}

      {step === "plan" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Target quarter</span>
              <select
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
                value={prefs.termCode}
                onChange={(e) => switchTerm(e.target.value)}
              >
                <option value="2271">Winter 2027 (2271)</option>
                <option value="2273">Spring 2027 (2273)</option>
              </select>
            </label>
            {needsChoiceCount > 0 && (
              <p className="text-sm text-amber-800">
                {needsChoiceCount} row(s) need a specific course code before ranking.
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Raw title</th>
                  <th className="px-3 py-2 font-medium">Course code</th>
                  <th className="px-3 py-2 font-medium">Credits</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((row, idx) => (
                  <tr key={`${row.row}-${idx}`} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2">{row.rawTitle}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-36 rounded border border-[var(--line)] px-2 py-1"
                        value={row.courseCode ?? ""}
                        placeholder="e.g. MATH& 152"
                        onChange={(e) => {
                          const v = e.target.value;
                          setPlanRows((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    courseCode: v || null,
                                    needsChoice: !v.trim(),
                                  }
                                : r,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">{row.credits ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.needsChoice || !row.courseCode ? (
                        <span className="text-amber-700">Needs choice</span>
                      ) : (
                        <span className="text-[var(--accent)]">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!planRows.length && (
                  <tr>
                    <td className="px-3 py-4 text-[var(--muted)]" colSpan={4}>
                      No courses found for {termLabel}. Try the other quarter or
                      edit rows after re-upload.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Earliest class
              <input
                type="time"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
                value={prefs.earliestTime}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, earliestTime: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Latest class
              <input
                type="time"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
                value={prefs.latestTime}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, latestTime: e.target.value }))
                }
              />
            </label>
            <fieldset className="text-sm">
              <legend className="mb-2 font-medium">Prefer days</legend>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((d) => (
                  <label key={d} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={prefs.preferDays.includes(d)}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          preferDays: e.target.checked
                            ? [...p.preferDays, d]
                            : p.preferDays.filter((x) => x !== d),
                        }))
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="text-sm">
              <legend className="mb-2 font-medium">Avoid days</legend>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((d) => (
                  <label key={d} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={prefs.avoidDays.includes(d)}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          avoidDays: e.target.checked
                            ? [...p.avoidDays, d]
                            : p.avoidDays.filter((x) => x !== d),
                        }))
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="text-sm md:col-span-2">
              <legend className="mb-2 font-medium">Instruction modes</legend>
              <div className="flex flex-wrap gap-3">
                {MODE_OPTIONS.map((m) => (
                  <label key={m} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={prefs.modes.includes(m)}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          modes: e.target.checked
                            ? [...p.modes, m]
                            : p.modes.filter((x) => x !== m),
                        }))
                      }
                    />
                    {m}
                  </label>
                ))}
                <span className="text-[var(--muted)]">(none = any)</span>
              </div>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm">
              Max credits
              <input
                type="number"
                min={1}
                max={30}
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
                value={prefs.maxCredits}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    maxCredits: Number(e.target.value) || 18,
                  }))
                }
              />
            </label>
            <div className="space-y-3 text-sm md:col-span-2">
              {(
                [
                  ["weightQuality", "Quality weight"],
                  ["weightEasiness", "Easiness weight"],
                  ["weightWouldTakeAgain", "Would-take-again weight"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="flex justify-between">
                    <span>{label}</span>
                    <span>{prefs[key]}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={prefs[key]}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        [key]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-4 py-2"
              onClick={() => setStep("upload")}
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy || planRows.every((r) => !r.courseCode)}
              className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:opacity-50"
              onClick={() => void onRecommend()}
            >
              {busy ? "Ranking…" : "Get recommendations"}
            </button>
          </div>
        </section>
      )}

      {step === "results" && (
        <section className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-[var(--ink)]">
              {termLabel} recommendations
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Data source: {dataSource || "unknown"}
            </p>
          </div>

          {recommendations.map((rec) => (
            <article
              key={rec.courseCode}
              className="space-y-3 rounded-2xl border border-[var(--line)] p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-semibold">{rec.courseCode}</h3>
                {rec.message && (
                  <span className="text-sm text-amber-800">{rec.message}</span>
                )}
              </div>
              {!rec.options.length && (
                <p className="text-[var(--muted)]">No ranked sections available.</p>
              )}
              <div className="grid gap-3">
                {rec.options.map((opt) => (
                  <div
                    key={`${opt.section.class_nbr}-${opt.rank}`}
                    className="rounded-xl bg-[var(--surface)] p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-white">
                        {opt.rankLabel}
                      </span>
                      <span className="font-medium">
                        Sec {opt.section.section} · #{opt.section.class_nbr}
                      </span>
                      <span className="text-[var(--muted)]">
                        score {opt.score}
                      </span>
                    </div>
                    <dl className="grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="inline text-[var(--muted)]">Professor: </dt>
                        <dd className="inline">
                          {opt.professorName}
                          {opt.flags.inferred && opt.inferredInstructor
                            ? ` (likely: ${opt.inferredInstructor})`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--muted)]">Mode: </dt>
                        <dd className="inline">{opt.section.instruction_mode}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--muted)]">When: </dt>
                        <dd className="inline">
                          {opt.section.days} {opt.section.start_time}–{opt.section.end_time}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--muted)]">Where: </dt>
                        <dd className="inline">{opt.section.location || "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--muted)]">Seats: </dt>
                        <dd className="inline">
                          {opt.section.seats_open}/{opt.section.capacity}
                          {Number(opt.section.waitlist) > 0
                            ? ` · WL ${opt.section.waitlist}`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--muted)]">RMP: </dt>
                        <dd className="inline">
                          {opt.rmp
                            ? `${opt.rmp.rating} / diff ${opt.rmp.difficulty} / WTA ${opt.rmp.would_take_again}`
                            : "n/a"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-sm text-[var(--muted)]">{opt.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {opt.flags.tba && <Flag>TBA / ARR</Flag>}
                      {opt.flags.staff && <Flag>Staff/TBA</Flag>}
                      {opt.flags.inferred && (
                        <Flag>Inferred instructor (unconfirmed)</Flag>
                      )}
                      {opt.flags.full && <Flag>Full</Flag>}
                      {opt.flags.conflict && <Flag>Conflicts w/ 1st</Flag>}
                      {opt.flags.waitlist && <Flag>Waitlist</Flag>}
                      {opt.flags.notOffered && <Flag>Not offered</Flag>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {opt.rmpUrl && (
                        <a
                          className="font-medium text-[var(--accent)] underline"
                          href={opt.rmpUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on RateMyProfessors
                        </a>
                      )}
                      {opt.enrollUrl && (
                        <a
                          className="font-medium text-[var(--accent)] underline"
                          href={opt.enrollUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Enroll in ctcLink
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}

          {schedule && (
            <article className="space-y-3 rounded-2xl border border-[var(--line)] p-5">
              <h3 className="text-xl font-semibold">Conflict-free schedule</h3>
              <p className="text-sm text-[var(--muted)]">
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
                    className="rounded-lg bg-[var(--surface)] px-3 py-2"
                  >
                    <strong>{b.courseCode}</strong> sec {b.section} (#{b.classNbr}) —{" "}
                    {b.professor}: {b.days} {b.startTime}–{b.endTime} @ {b.location}{" "}
                    <span className="text-[var(--muted)]">
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
            </article>
          )}

          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-4 py-2"
            onClick={() => setStep("plan")}
          >
            Adjust preferences
          </button>
        </section>
      )}
    </div>
  );
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
      {children}
    </span>
  );
}

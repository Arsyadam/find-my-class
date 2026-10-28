"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PlannedCourse } from "@/lib/edplan";
import type {
  BuiltSchedule,
  CourseRecommendation,
  UserPreferences,
} from "@/lib/ranking";
import {
  EFFORT_WEIGHTS,
  reducedStepVariants,
  stepEase,
  stepVariants,
  type EffortLevel,
} from "@/lib/motion";
import { LandingStep } from "@/components/wizard/LandingStep";
import { ChooseStep, type ChooseResult } from "@/components/wizard/ChooseStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { PrefsStep } from "@/components/wizard/PrefsStep";
import { ResultsStep } from "@/components/wizard/ResultsStep";

type Step = "landing" | "choose" | "review" | "prefs" | "results";

const DEFAULT_PREFS: UserPreferences = {
  termCode: "2271",
  earliestTime: "08:00",
  latestTime: "18:00",
  preferDays: [],
  avoidDays: [],
  modes: [],
  maxCredits: 18,
  weightQuality: 40,
  weightEasiness: 30,
  weightWouldTakeAgain: 30,
};

export function PlannerApp() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("landing");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [planRows, setPlanRows] = useState<PlannedCourse[]>([]);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>(
    [],
  );
  const [schedule, setSchedule] = useState<BuiltSchedule | null>(null);
  const [dataSource, setDataSource] = useState("");

  const termLabel = prefs.termCode === "2273" ? "Spring 2027" : "Winter 2027";
  const courseCodes = useMemo(
    () =>
      planRows
        .filter((r) => r.courseCode && !r.needsChoice)
        .map((r) => r.courseCode as string),
    [planRows],
  );

  const variants = reduce ? reducedStepVariants : stepVariants;

  async function parsePdf(file: File, termCode: string, effort: EffortLevel) {
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/parse", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parse failed");
      const weights = EFFORT_WEIGHTS[effort];
      setPrefs((p) => ({ ...p, termCode, ...weights }));
      const rows: PlannedCourse[] = (json.terms?.[termCode] || [])
        .slice(0, 4)
        .map((r: PlannedCourse) => ({ ...r }));
      setPlanRows(rows);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function applyTyped(courses: string[], termCode: string, effort: EffortLevel) {
    const weights = EFFORT_WEIGHTS[effort];
    setPrefs((p) => ({ ...p, termCode, ...weights }));
    setPlanRows(
      courses.map((code, i) => ({
        rawTitle: code,
        courseCode: code,
        subject: null,
        catalogNbr: null,
        credits: null,
        needsChoice: false,
        notes: [],
        termCode,
        termLabel: termCode === "2273" ? "Spring 2027" : "Winter 2027",
        row: i + 1,
      })),
    );
    setStep("review");
  }

  async function onChoose(result: ChooseResult) {
    if (result.mode === "pdf") {
      await parsePdf(result.file, result.termCode, result.effort);
      return;
    }
    applyTyped(result.courses, result.termCode, result.effort);
  }

  async function onRecommend() {
    setError(null);
    setBusy(true);
    try {
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

  function restart() {
    setStep("landing");
    setError(null);
    setBusy(false);
    setPrefs(DEFAULT_PREFS);
    setPlanRows([]);
    setRecommendations([]);
    setSchedule(null);
    setDataSource("");
  }

  return (
    <div className="relative min-h-[100dvh] w-full">
      {error && step !== "landing" && (
        <div
          role="alert"
          className="mx-auto mt-4 max-w-[720px] rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "landing" && (
          <motion.div
            key="landing"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduce ? { duration: 0 } : stepEase}
          >
            <LandingStep onStart={() => setStep("choose")} />
          </motion.div>
        )}

        {step === "choose" && (
          <motion.div
            key="choose"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduce ? { duration: 0 } : stepEase}
          >
            <ChooseStep
              busy={busy}
              onBack={() => setStep("landing")}
              onContinue={(r) => void onChoose(r)}
            />
          </motion.div>
        )}

        {step === "review" && (
          <motion.div
            key="review"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduce ? { duration: 0 } : stepEase}
          >
            <ReviewStep
              termLabel={termLabel}
              rows={planRows}
              onChange={setPlanRows}
              onBack={() => setStep("choose")}
              onContinue={() => setStep("prefs")}
            />
          </motion.div>
        )}

        {step === "prefs" && (
          <motion.div
            key="prefs"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduce ? { duration: 0 } : stepEase}
          >
            <PrefsStep
              prefs={prefs}
              onChange={setPrefs}
              busy={busy}
              onBack={() => setStep("review")}
              onContinue={() => void onRecommend()}
            />
          </motion.div>
        )}

        {step === "results" && (
          <motion.div
            key="results"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduce ? { duration: 0 } : stepEase}
          >
            <ResultsStep
              termLabel={termLabel}
              courseCodes={courseCodes}
              recommendations={recommendations}
              schedule={schedule}
              dataSource={dataSource}
              onBack={() => setStep("prefs")}
              onRestart={restart}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

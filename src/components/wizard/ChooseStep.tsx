"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FileUp, Keyboard } from "lucide-react";
import {
  PromptInput,
  type PromptSubmitMeta,
} from "@/components/ui/ai-chat-input";
import { TERM_OPTIONS, type EffortLevel } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type ChooseResult =
  | { mode: "pdf"; file: File; termCode: string; effort: EffortLevel }
  | { mode: "typed"; courses: string[]; termCode: string; effort: EffortLevel };

type Props = {
  onBack: () => void;
  onContinue: (result: ChooseResult) => void;
  busy?: boolean;
};

export function ChooseStep({ onBack, onContinue, busy }: Props) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<"pdf" | "typed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(_message: string, meta: PromptSubmitMeta) {
    setError(null);
    const effort = (meta.effort as EffortLevel) || "medium";
    const termCode = meta.model || "2271";

    if (mode === "pdf") {
      if (!meta.attachments[0]) {
        setError("Attach a PDF Educational Plan to continue.");
        return;
      }
      onContinue({
        mode: "pdf",
        file: meta.attachments[0],
        termCode,
        effort,
      });
      return;
    }

    const courses = (meta.courses.length ? meta.courses : []).slice(0, 4);
    if (!courses.length) {
      setError("Add up to 4 course codes from the catalog.");
      return;
    }
    onContinue({ mode: "typed", courses, termCode, effort });
  }

  return (
    <section className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Choose how to start
        </h1>
        <p className="text-muted-foreground">
          Upload an Educational Plan PDF, or type up to four course codes.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: "pdf" as const,
              title: "Upload Edplan",
              body: "Parse Winter / Spring rows from your plan.",
              icon: FileUp,
            },
            {
              id: "typed" as const,
              title: "Type courses",
              body: "Pick codes like ENGL 128 or POLS& 202.",
              icon: Keyboard,
            },
          ] as const
        ).map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              type="button"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { delay: i * 0.06, type: "spring", stiffness: 280, damping: 28 }
              }
              onClick={() => {
                setMode(opt.id);
                setError(null);
              }}
              className={cn(
                "rounded-2xl border border-border glass-shell px-4 py-4 text-left transition-colors hover:bg-accent/60",
                mode === opt.id && "border-primary ring-2 ring-ring/30",
              )}
            >
              <Icon className="mb-3 size-5 text-primary" aria-hidden />
              <div className="font-semibold">{opt.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{opt.body}</p>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {mode && (
          <motion.div
            key={mode}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 280, damping: 28 }
            }
          >
            <PromptInput
              disabled={busy}
              error={error}
              onError={setError}
              models={[...TERM_OPTIONS]}
              courseNuggets={mode === "typed"}
              placeholder={
                mode === "pdf"
                  ? "Attach or drop your Educational Plan PDF, pick a term, then send…"
                  : "Start typing a course code…"
              }
              onSubmit={handleSubmit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Back
        </button>
      </div>
    </section>
  );
}

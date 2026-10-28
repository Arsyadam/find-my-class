"use client";

import type { UserPreferences } from "@/lib/ranking";
import { TimeRangeDial } from "@/components/TimeRangeDial";
import { cn } from "@/lib/utils";

const DAY_OPTIONS = ["M", "T", "W", "Th", "F"] as const;
const MODE_OPTIONS = ["In Person", "Online", "Hybrid"] as const;

type Props = {
  prefs: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
  onBack: () => void;
  onContinue: () => void;
  busy?: boolean;
};

export function PrefsStep({
  prefs,
  onChange,
  onBack,
  onContinue,
  busy,
}: Props) {
  return (
    <section className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Schedule preferences
        </h1>
        <p className="text-muted-foreground">
          Set your class time window, days, mode, and credit cap.
        </p>
      </header>

      <TimeRangeDial
        earliest={prefs.earliestTime}
        latest={prefs.latestTime}
        onChange={({ earliest, latest }) =>
          onChange({ ...prefs, earliestTime: earliest, latestTime: latest })
        }
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Prefer days</legend>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <Chip
                key={`p-${d}`}
                active={prefs.preferDays.includes(d)}
                onClick={() =>
                  onChange({
                    ...prefs,
                    preferDays: prefs.preferDays.includes(d)
                      ? prefs.preferDays.filter((x) => x !== d)
                      : [...prefs.preferDays, d],
                  })
                }
              >
                {d}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Avoid days</legend>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <Chip
                key={`a-${d}`}
                active={prefs.avoidDays.includes(d)}
                onClick={() =>
                  onChange({
                    ...prefs,
                    avoidDays: prefs.avoidDays.includes(d)
                      ? prefs.avoidDays.filter((x) => x !== d)
                      : [...prefs.avoidDays, d],
                  })
                }
              >
                {d}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Instruction modes</legend>
          <div className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map((m) => (
              <Chip
                key={m}
                active={prefs.modes.includes(m)}
                onClick={() =>
                  onChange({
                    ...prefs,
                    modes: prefs.modes.includes(m)
                      ? prefs.modes.filter((x) => x !== m)
                      : [...prefs.modes, m],
                  })
                }
              >
                {m}
              </Chip>
            ))}
            <span className="self-center text-sm text-muted-foreground">
              (none = any)
            </span>
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          Max credits
          <input
            type="number"
            min={1}
            max={30}
            className="rounded-xl border border-border bg-card px-3 py-2 outline-none focus:ring-2 focus:ring-ring/40"
            value={prefs.maxCredits}
            onChange={(e) =>
              onChange({
                ...prefs,
                maxCredits: Number(e.target.value) || 18,
              })
            }
          />
        </label>
      </div>

      <div className="space-y-3 text-sm">
        {(
          [
            ["weightQuality", "Quality"],
            ["weightEasiness", "Easiness"],
            ["weightWouldTakeAgain", "Would take again"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="flex justify-between">
              <span>{label}</span>
              <span className="tabular-nums text-muted-foreground">
                {prefs[key]}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={prefs[key]}
              onChange={(e) =>
                onChange({ ...prefs, [key]: Number(e.target.value) })
              }
              className="accent-[var(--primary)]"
            />
          </label>
        ))}
      </div>

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
          disabled={busy}
          onClick={onContinue}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Ranking…" : "Get recommendations"}
        </button>
      </div>
    </section>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

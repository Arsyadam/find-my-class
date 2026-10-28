import type { Transition, Variants } from "framer-motion";

export const stepEase: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 28,
};

export const stepExitTransition: Transition = {
  duration: 0.18,
  ease: "easeIn",
};

export const stepVariants: Variants = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: 12, filter: "blur(4px)" },
};

/** Instant opacity-only when prefers-reduced-motion is on */
export const reducedStepVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const EFFORT_WEIGHTS = {
  low: { weightQuality: 25, weightEasiness: 55, weightWouldTakeAgain: 20 },
  medium: { weightQuality: 40, weightEasiness: 30, weightWouldTakeAgain: 30 },
  max: { weightQuality: 60, weightEasiness: 15, weightWouldTakeAgain: 25 },
} as const;

export type EffortLevel = keyof typeof EFFORT_WEIGHTS;

export const TERM_OPTIONS = [
  { value: "2271", label: "Winter 2027" },
  { value: "2273", label: "Spring 2027" },
] as const;

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MapPinned } from "lucide-react";

type Props = {
  onStart: () => void;
};

export function LandingStep({ onStart }: Props) {
  const reduce = useReducedMotion();

  return (
    <section className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
        <motion.h1
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 260, damping: 28 }
          }
          className="font-display text-[clamp(2.4rem,7vw,4.25rem)] font-semibold leading-[1.05] tracking-tight text-foreground"
        >
          Plan Your Best Quarter in GRC
        </motion.h1>
        <motion.p
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : { delay: 0.06, type: "spring", stiffness: 260, damping: 28 }
          }
          className="max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Rank sections and professors from your Educational Plan, or type up to
          four courses, for Winter or Spring 2027.
        </motion.p>
        <motion.button
          type="button"
          onClick={onStart}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={
            reduce
              ? { opacity: 1 }
              : {
                  opacity: 1,
                  y: 0,
                  scale: [1, 1.02, 1],
                }
          }
          transition={
            reduce
              ? { duration: 0 }
              : {
                  opacity: { type: "spring", stiffness: 260, damping: 28, delay: 0.1 },
                  y: { type: "spring", stiffness: 260, damping: 28, delay: 0.1 },
                  scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                }
          }
          whileHover={
            reduce
              ? undefined
              : {
                  y: -2,
                  boxShadow: "0 14px 36px -18px rgba(194,74,50,0.7)",
                }
          }
          whileTap={reduce ? undefined : { scale: 0.97 }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_10px_28px_-14px_rgba(194,74,50,0.65)]"
        >
          <MapPinned className="size-5" aria-hidden />
          Find My Class
        </motion.button>
      </div>
    </section>
  );
}

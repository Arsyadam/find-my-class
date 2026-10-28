"use client";

import { useState } from "react";
import {
  PromptInput,
  type PromptSubmitMeta,
} from "@/components/ui/ai-chat-input";
import { TERM_OPTIONS } from "@/lib/motion";

export default function PromptDemoPage() {
  const [last, setLast] = useState<string>("");

  function onSubmit(message: string, meta: PromptSubmitMeta) {
    setLast(
      JSON.stringify(
        {
          message,
          model: meta.model,
          effort: meta.effort,
          files: meta.attachments.map((f) => f.name),
        },
        null,
        2,
      ),
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">PromptInput demo</h1>
      <p className="text-sm text-muted-foreground">
        PDF attach only · term picker · ranking emphasis · motion intact
      </p>
      <PromptInput
        models={[...TERM_OPTIONS]}
        placeholder="ENGL 128, POLS& 202…"
        onSubmit={onSubmit}
      />
      {last && (
        <pre className="overflow-auto rounded-xl border border-border bg-card p-3 text-xs">
          {last}
        </pre>
      )}
    </main>
  );
}

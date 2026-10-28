"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  ChevronDown,
  FileText,
  Mic,
  Paperclip,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PromptModel = { value: string; label: string };
export type PromptEffort = { value: string; label: string };

export type PromptSubmitMeta = {
  model: string;
  effort: string;
  attachments: File[];
};

export type PromptInputProps = {
  onSubmit: (message: string, meta: PromptSubmitMeta) => void;
  placeholder?: string;
  models?: PromptModel[];
  efforts?: PromptEffort[];
  defaultModel?: string;
  defaultEffort?: string;
  className?: string;
  /** PDF only — images rejected */
  accept?: string;
  disabled?: boolean;
  error?: string | null;
  onError?: (message: string | null) => void;
};

const DEFAULT_MODELS: PromptModel[] = [
  { value: "2271", label: "Winter 2027" },
  { value: "2273", label: "Spring 2027" },
];

const DEFAULT_EFFORTS: PromptEffort[] = [
  { value: "low", label: "Easy" },
  { value: "medium", label: "Balanced" },
  { value: "max", label: "Quality" },
];

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    name.endsWith(".pdf") ||
    file.type === "application/x-pdf"
  );
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name);
}

export function PromptInput({
  onSubmit,
  placeholder = "ENGL 128, POLS& 202…",
  models = DEFAULT_MODELS,
  efforts = DEFAULT_EFFORTS,
  defaultModel,
  defaultEffort = "medium",
  className,
  accept = ".pdf,application/pdf",
  disabled = false,
  error = null,
  onError,
}: PromptInputProps) {
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [model, setModel] = React.useState(defaultModel ?? models[0]?.value ?? "");
  const [effort, setEffort] = React.useState(defaultEffort);
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [effortOpen, setEffortOpen] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [bars, setBars] = React.useState([0.3, 0.55, 0.4, 0.7, 0.45]);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (defaultModel) setModel(defaultModel);
  }, [defaultModel]);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  React.useEffect(() => {
    if (!listening || reduce) return;
    const id = window.setInterval(() => {
      setBars((prev) => prev.map(() => 0.25 + Math.random() * 0.75));
    }, 120);
    return () => window.clearInterval(id);
  }, [listening, reduce]);

  function reject(msg: string) {
    onError?.(msg);
  }

  function addFiles(list: FileList | File[]) {
    const next: File[] = [];
    for (const file of Array.from(list)) {
      if (isImageFile(file)) {
        reject("Images are not accepted — upload a PDF Educational Plan only.");
        continue;
      }
      if (!isPdfFile(file)) {
        reject("Only PDF files are accepted.");
        continue;
      }
      next.push(file);
    }
    if (next.length) {
      onError?.(null);
      setAttachments((prev) => [...prev, ...next].slice(0, 1));
    }
  }

  function submit() {
    if (disabled) return;
    const message = value.trim();
    if (!message && attachments.length === 0) return;
    onSubmit(message, { model, effort, attachments });
  }

  const expanded = focused || value.length > 0 || attachments.length > 0;
  const modelLabel = models.find((m) => m.value === model)?.label ?? model;
  const effortLabel = efforts.find((e) => e.value === effort)?.label ?? effort;
  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0);

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.85 };

  return (
    <div className={cn("w-full", className)}>
      <motion.div
        layout
        transition={spring}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_40px_-24px_rgba(20,32,26,0.35)]",
          focused && "ring-2 ring-ring/40",
        )}
      >
        <AnimatePresence initial={false}>
          {attachments.length > 0 && (
            <motion.div
              key="tray"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
              transition={spring}
              className="border-b border-border bg-muted/70 px-3 py-2"
            >
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, i) => (
                  <motion.div
                    key={`${file.name}-${i}`}
                    layout
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-sm"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <span className="max-w-[10rem] truncate font-medium">{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <X className="size-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-3 pt-3">
          <textarea
            ref={textareaRef}
            rows={1}
            disabled={disabled}
            value={value}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              const items = e.clipboardData?.files;
              if (items?.length) {
                e.preventDefault();
                addFiles(items);
              }
            }}
            className="max-h-40 w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/80"
          />
        </div>

        <motion.div
          layout
          className={cn(
            "flex items-center gap-1.5 px-2 pb-2 pt-1",
            expanded ? "opacity-100" : "opacity-90",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <ToolbarButton
            label="Attach Educational Plan PDF"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="size-4" />
          </ToolbarButton>

          <div className="relative">
            <ToolbarButton
              label="Select term"
              onClick={() => {
                setModelOpen((o) => !o);
                setEffortOpen(false);
              }}
              disabled={disabled}
              className="gap-1 px-2"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={modelLabel}
                  initial={reduce ? false : { opacity: 0, y: 4, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? undefined : { opacity: 0, y: -4, filter: "blur(3px)" }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="text-xs font-medium"
                >
                  {modelLabel}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className="size-3.5 opacity-60" />
            </ToolbarButton>
            <Menu
              open={modelOpen}
              onClose={() => setModelOpen(false)}
              items={models}
              value={model}
              onSelect={(v) => {
                setModel(v);
                setModelOpen(false);
              }}
              reduce={!!reduce}
            />
          </div>

          <div className="relative">
            <ToolbarButton
              label="Ranking emphasis"
              onClick={() => {
                setEffortOpen((o) => !o);
                setModelOpen(false);
              }}
              disabled={disabled}
              className="gap-1 px-2"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={effortLabel}
                  initial={reduce ? false : { opacity: 0, y: 4, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? undefined : { opacity: 0, y: -4, filter: "blur(3px)" }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="text-xs font-medium"
                >
                  {effortLabel}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className="size-3.5 opacity-60" />
            </ToolbarButton>
            <Menu
              open={effortOpen}
              onClose={() => setEffortOpen(false)}
              items={efforts}
              value={effort}
              onSelect={(v) => {
                setEffort(v);
                setEffortOpen(false);
              }}
              reduce={!!reduce}
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ToolbarButton
              label={listening ? "Stop microphone preview" : "Microphone preview"}
              onClick={() => setListening((v) => !v)}
              disabled={disabled}
              className={listening ? "bg-accent text-primary" : undefined}
            >
              {listening && !reduce ? (
                <span className="flex h-4 items-end gap-0.5" aria-hidden>
                  {bars.map((h, i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-full bg-primary"
                      style={{ height: `${Math.max(4, h * 14)}px` }}
                    />
                  ))}
                </span>
              ) : (
                <Mic className="size-4" />
              )}
            </ToolbarButton>

            <motion.button
              type="button"
              aria-label="Send"
              disabled={!canSend}
              whileHover={reduce || !canSend ? undefined : { scale: 1.04 }}
              whileTap={reduce || !canSend ? undefined : { scale: 0.94 }}
              onClick={submit}
              className={cn(
                "flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity",
                !canSend && "opacity-40",
              )}
            >
              <ArrowUp className="size-4" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-full px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Menu({
  open,
  onClose,
  items,
  value,
  onSelect,
  reduce,
}: {
  open: boolean;
  onClose: () => void;
  items: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  reduce: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onDoc = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer so the opening click does not immediately close the menu.
    const id = window.setTimeout(() => {
      window.addEventListener("click", onDoc);
    }, 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.ul
          role="listbox"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
          className="absolute bottom-full left-0 z-20 mb-1.5 min-w-[10rem] origin-bottom overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                role="option"
                aria-selected={item.value === value}
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm hover:bg-accent",
                  item.value === value && "font-semibold text-primary",
                )}
                onClick={() => onSelect(item.value)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}

export default PromptInput;

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  ChevronDown,
  FileText,
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
  /** Selected course nuggets (typed mode) */
  courses?: string[];
};

export type PromptInputProps = {
  onSubmit: (message: string, meta: PromptSubmitMeta) => void;
  placeholder?: string;
  models?: PromptModel[];
  efforts?: PromptEffort[];
  defaultModel?: string;
  defaultEffort?: string;
  className?: string;
  /** PDF only. Images rejected. */
  accept?: string;
  disabled?: boolean;
  error?: string | null;
  onError?: (message: string | null) => void;
  /** Restrict UI to PDF attach or typed course chips. */
  mode?: "pdf" | "typed" | "both";
  /** Course codes available for autocomplete (typed mode). */
  courseSuggestions?: string[];
  maxCourses?: number;
  /** Fired when the term (model) picker changes. */
  onModelChange?: (model: string) => void;
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
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name)
  );
}

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
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
  mode = "both",
  courseSuggestions = [],
  maxCourses = 4,
  onModelChange,
}: PromptInputProps) {
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [model, setModel] = React.useState(
    defaultModel ?? models[0]?.value ?? "",
  );
  const [effort, setEffort] = React.useState(defaultEffort);
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [courses, setCourses] = React.useState<string[]>([]);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [effortOpen, setEffortOpen] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const modelBtnRef = React.useRef<HTMLButtonElement>(null);
  const effortBtnRef = React.useRef<HTMLButtonElement>(null);
  const allowPdf = mode === "pdf" || mode === "both";
  const allowTyped = mode === "typed" || mode === "both";

  React.useEffect(() => {
    if (defaultModel) setModel(defaultModel);
  }, [defaultModel]);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function reject(msg: string) {
    onError?.(msg);
  }

  function addFiles(list: FileList | File[]) {
    if (!allowPdf) {
      reject("Switch to Upload Edplan to attach a PDF.");
      return;
    }
    const next: File[] = [];
    for (const file of Array.from(list)) {
      if (isImageFile(file)) {
        reject("Images are not accepted. Upload a PDF Educational Plan only.");
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

  function addCourse(raw: string) {
    const code = normalizeCode(raw);
    if (!code) return;
    if (courses.some((c) => normalizeCode(c) === code)) {
      setValue("");
      return;
    }
    if (courses.length >= maxCourses) {
      reject(`Enter at most ${maxCourses} courses.`);
      return;
    }
    onError?.(null);
    setCourses((prev) => [...prev, code]);
    setValue("");
    setSuggestOpen(false);
  }

  function removeCourse(code: string) {
    setCourses((prev) => prev.filter((c) => c !== code));
  }

  const query = value.trim();
  const suggestions = React.useMemo(() => {
    if (!allowTyped || !query) return [];
    const q = normalizeCode(query);
    const selected = new Set(courses.map(normalizeCode));
    return courseSuggestions
      .filter((c) => {
        const n = normalizeCode(c);
        if (selected.has(n)) return false;
        return n.includes(q) || n.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
      })
      .slice(0, 8);
  }, [allowTyped, query, courseSuggestions, courses]);

  React.useEffect(() => {
    setSuggestOpen(allowTyped && focused && suggestions.length > 0);
  }, [allowTyped, focused, suggestions.length]);

  function submit() {
    if (disabled) return;
    const message = value.trim();
    if (allowTyped && courses.length === 0 && message) {
      // Commit leftover typed token if it matches a suggestion or looks like a code
      const match =
        suggestions.find((s) => normalizeCode(s) === normalizeCode(message)) ||
        (/\b[A-Z]{2,6}&?\s*\d{2,4}[A-Z]?\b/i.test(message) ? message : null);
      if (match) {
        const next = [...courses, normalizeCode(match)].slice(0, maxCourses);
        onSubmit(next.join(", "), {
          model,
          effort,
          attachments,
          courses: next,
        });
        return;
      }
    }
    if (!message && attachments.length === 0 && courses.length === 0) return;
    onSubmit(message, {
      model,
      effort,
      attachments,
      courses: courses.length ? courses : undefined,
    });
  }

  const expanded =
    focused ||
    value.length > 0 ||
    attachments.length > 0 ||
    courses.length > 0;
  const modelLabel = models.find((m) => m.value === model)?.label ?? model;
  const effortLabel = efforts.find((e) => e.value === effort)?.label ?? effort;
  const canSend =
    !disabled &&
    (attachments.length > 0 ||
      courses.length > 0 ||
      (allowTyped && value.trim().length > 0));

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.85 };

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div className={cn("w-full", className)}>
      <motion.div
        layout
        transition={spring}
        onDragEnter={(e) => {
          e.preventDefault();
          if (allowPdf) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (allowPdf) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={cn(
          "relative rounded-2xl border border-border bg-card/90 shadow-[0_10px_40px_-24px_rgba(40,20,30,0.35)] backdrop-blur-sm",
          focused && "ring-2 ring-ring/40",
          dragOver && "border-primary ring-2 ring-ring/50",
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
              className="overflow-hidden border-b border-border bg-muted/70 px-3 py-2"
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
                    <span className="max-w-[10rem] truncate font-medium">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
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

        {allowTyped && courses.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2">
            <AnimatePresence initial={false}>
              {courses.map((code) => (
                <motion.span
                  key={code}
                  layout
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  className="font-mono-course inline-flex items-center gap-1 rounded-full border border-border bg-accent/80 px-2.5 py-1 text-xs font-medium"
                >
                  {code}
                  <button
                    type="button"
                    aria-label={`Remove ${code}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"
                    onClick={() => removeCourse(code)}
                  >
                    <X className="size-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="relative px-3 pt-3">
          {allowTyped ? (
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={disabled || courses.length >= maxCourses}
              value={value}
              placeholder={
                courses.length >= maxCourses
                  ? `Max ${maxCourses} courses selected`
                  : placeholder
              }
              onFocus={() => setFocused(true)}
              onBlur={() => {
                // Delay so suggestion click can register
                window.setTimeout(() => setFocused(false), 120);
              }}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (suggestions[0] && value.trim()) {
                    addCourse(suggestions[0]);
                    return;
                  }
                  if (value.trim() && /\b[A-Z]{2,6}&?\s*\d{2,4}/i.test(value)) {
                    addCourse(value);
                    return;
                  }
                  submit();
                }
                if (e.key === "Backspace" && !value && courses.length) {
                  removeCourse(courses[courses.length - 1]);
                }
                if (e.key === "Escape") setSuggestOpen(false);
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.files;
                if (items?.length && allowPdf) {
                  e.preventDefault();
                  addFiles(items);
                }
              }}
              className="max-h-40 w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/80"
            />
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex min-h-[3rem] w-full items-center text-left text-[15px] leading-relaxed text-muted-foreground outline-none"
            >
              {dragOver
                ? "Drop your Educational Plan PDF here"
                : placeholder}
            </button>
          )}

          <AnimatePresence>
            {suggestOpen && suggestions.length > 0 && (
              <motion.ul
                role="listbox"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-2 right-2 z-30 mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
              >
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="font-mono-course flex w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addCourse(s);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
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

          {allowPdf && (
            <ToolbarButton
              label="Attach Educational Plan PDF"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
            >
              <Paperclip className="size-4" />
            </ToolbarButton>
          )}

          <div className="relative">
            <ToolbarButton
              ref={modelBtnRef}
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
                  initial={
                    reduce ? false : { opacity: 0, y: 4, filter: "blur(3px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    reduce
                      ? undefined
                      : { opacity: 0, y: -4, filter: "blur(3px)" }
                  }
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="text-xs font-medium"
                >
                  {modelLabel}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className="size-3.5 opacity-60" />
            </ToolbarButton>
            <PortalMenu
              open={modelOpen}
              anchorRef={modelBtnRef}
              onClose={() => setModelOpen(false)}
              items={models}
              value={model}
              onSelect={(v) => {
                setModel(v);
                setModelOpen(false);
                onModelChange?.(v);
              }}
              reduce={!!reduce}
            />
          </div>

          <div className="relative">
            <ToolbarButton
              ref={effortBtnRef}
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
                  initial={
                    reduce ? false : { opacity: 0, y: 4, filter: "blur(3px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    reduce
                      ? undefined
                      : { opacity: 0, y: -4, filter: "blur(3px)" }
                  }
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="text-xs font-medium"
                >
                  {effortLabel}
                </motion.span>
              </AnimatePresence>
              <ChevronDown className="size-3.5 opacity-60" />
            </ToolbarButton>
            <PortalMenu
              open={effortOpen}
              anchorRef={effortBtnRef}
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

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
  }
>(function ToolbarButton(
  { children, label, onClick, disabled, className },
  ref,
) {
  return (
    <button
      ref={ref}
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
});

function PortalMenu({
  open,
  onClose,
  items,
  value,
  onSelect,
  reduce,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  items: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  reduce: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    place: "above" | "below";
  } | null>(null);

  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const menuHeight = items.length * 40 + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const place =
      spaceBelow < menuHeight && rect.top > menuHeight ? "above" : "below";
    setPos({
      top: place === "below" ? rect.bottom + 6 : rect.top - 6,
      left: rect.left,
      place,
    });
  }, [open, items.length, anchorRef]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = () => onClose();
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", onDoc);
    }, 0);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.ul
          role="listbox"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
          style={{
            position: "fixed",
            top: pos.place === "below" ? pos.top : undefined,
            bottom:
              pos.place === "above"
                ? window.innerHeight - pos.top
                : undefined,
            left: pos.left,
          }}
          className="z-[80] min-w-[10rem] overflow-visible rounded-xl border border-border bg-card py-1 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
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
    </AnimatePresence>,
    document.body,
  );
}

export default PromptInput;

"use client";

import { Check, CircleX, ClipboardPaste, Link2, LoaderCircle, Minus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/media";
import { usePresence } from "@/lib/presence";
import type { CheckStep, VideoCheck } from "@/lib/types";
import { youTubeId } from "@/lib/youtube-link";
import { ACCENT, BUTTON_PRIMARY, BUTTON_SECONDARY, EYEBROW, PANEL_TITLE, TILE } from "./brand";
import { Cover } from "./Cover";

interface Props {
  open: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
}

const STEPS = [
  { title: "Copy the link", text: "In YouTube, tap Share under the video, then Copy link." },
  { title: "Paste it here", text: "Shorts, youtu.be and watch links all work." },
  {
    title: "Tap any word",
    text: "A new video is prepared once, in about a minute. Then every word and phrase in it is explained in Azerbaijani.",
  },
];

/** The checks shown for a video before it is opened, in the order they are made. */
const CHECKS = [
  { key: "video", label: "Video" },
  { key: "language", label: "Language" },
  { key: "subtitles", label: "Subtitles" },
] as const;

/** Every check passed: they stay on screen this long, so they are seen, before the video opens. */
const OPEN_AFTER_MS = 800;

/** Where the check of a video stands: under way, its answer, or no answer from the server. */
type Checking = { id: string } & ({ state: "checking" } | { state: "done"; result: VideoCheck } | { state: "error" });

/**
 * The plus button's page: a YouTube video by its link. The video is checked here first: that YouTube
 * lets it play here, its language, its subtitles. Only then is the viewer sent on to it, at the top
 * of the feed, where it is prepared if Scrollish has not seen it yet. Phones: a page above the
 * navigation bar, like the Library and the Profile. Desktop: over the feed.
 */
export function AddVideo({ open, onOpen, onClose }: Props) {
  const { mounted, closing } = usePresence(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        closing ? "pointer-events-none animate-fade-out" : "animate-fade-in",
        "fixed inset-x-0 top-0 bottom-[var(--nav-h)] z-40 flex flex-col bg-bg md:bg-black/75 md:backdrop-blur-2xl md:backdrop-saturate-150",
      )}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {/* Mounted only while open, so every visit starts with an empty field. */}
        <AddVideoForm onOpen={onOpen} onClose={onClose} />
      </div>
    </div>
  );
}

function AddVideoForm({ onOpen, onClose }: Omit<Props, "open">) {
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [checking, setChecking] = useState<Checking | null>(null);
  /** With a mouse the field takes the focus at once. On a phone that would push the keyboard up over the page. */
  const pointer = useMediaQuery("(pointer: fine)");
  const canPaste = typeof navigator.clipboard?.readText === "function";
  const id = youTubeId(link);
  const result = checking?.state === "done" ? checking.result : null;

  useEffect(() => {
    if (pointer) input.current?.focus();
  }, [pointer]);

  // All good: on to the video. Editing the link meanwhile drops the check, and with it this.
  useEffect(() => {
    if (checking?.state !== "done" || !checking.result.ok) return;
    const timer = window.setTimeout(() => onOpen(checking.id), OPEN_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [checking, onOpen]);

  const change = (value: string) => {
    setLink(value);
    setInvalid(false);
    setChecking(null);
  };

  // The browser may ask first, or refuse: then the field is ready for the system's own paste.
  const paste = async () => {
    try {
      change((await navigator.clipboard.readText()).trim());
    } catch {
      input.current?.focus();
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) {
      setInvalid(true);
      return;
    }
    if (checking?.id === id && checking.state !== "error") return;
    setChecking({ id, state: "checking" });
    // An answer for a link that has been changed since is dropped.
    const settle = (next: Checking) => setChecking((now) => (now?.id === id ? next : now));
    try {
      const res = await fetch(`/api/check/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      settle({ id, state: "done", result: (await res.json()) as VideoCheck });
    } catch {
      settle({ id, state: "error" });
    }
  };

  const busy = checking?.state === "checking" || !!result?.ok;

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-xl px-4 pb-8 pt-[calc(14px+env(safe-area-inset-top))] md:pt-[calc(40px+env(safe-area-inset-top))]"
    >
      <div className="flex items-center justify-between">
        <h2 className={PANEL_TITLE}>Add a video</h2>
        <button type="button" onClick={onClose} aria-label="Close" className={cn(BUTTON_SECONDARY, "size-10 max-md:hidden")}>
          <X size={20} />
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Any YouTube Short, with its subtitles made tappable and every word explained in Azerbaijani.
      </p>

      <div
        className={cn(
          "mt-6 flex h-14 items-center gap-2 rounded-lg border bg-surface pl-4 pr-2 transition-colors",
          invalid ? "border-rose-400" : "border-line focus-within:border-accent",
        )}
      >
        <Link2 size={18} className="shrink-0 text-muted" />
        <input
          ref={input}
          value={link}
          onChange={(e) => change(e.target.value)}
          inputMode="url"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="youtube.com/shorts/..."
          aria-label="YouTube link"
          aria-invalid={invalid}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        {link ? (
          <button
            type="button"
            onClick={() => {
              change("");
              input.current?.focus();
            }}
            aria-label="Clear"
            className="liquid grid size-10 shrink-0 place-items-center rounded-full text-muted hover:text-white"
          >
            <CircleX size={18} />
          </button>
        ) : (
          canPaste && (
            <button
              type="button"
              onClick={paste}
              title="Paste"
              aria-label="Paste"
              className={cn(BUTTON_SECONDARY, "size-10 shrink-0")}
            >
              <ClipboardPaste size={18} />
            </button>
          )
        )}
      </div>
      {invalid && <p className="mt-2 text-sm text-rose-300">That does not look like a YouTube video link.</p>}

      {/*
        As soon as the link holds a video: its cover, to see it is the right one before opening it,
        and once it is being checked, the checks under it. The title comes with the answer.
      */}
      {id && (
        <div className={cn(TILE, "animate-rise mt-4 p-3")}>
          <div className="flex items-center gap-4">
            <span className="relative aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
              <Cover key={id} id={id} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-semibold">{result?.title || "Video found"}</span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {result?.channelTitle || `youtube.com/shorts/${id}`}
              </span>
            </span>
          </div>
          {checking?.id === id && <Checks checking={checking} />}
        </div>
      )}

      <button
        type="submit"
        disabled={!link.trim() || busy || result?.ok === false}
        className={cn(BUTTON_PRIMARY, "mt-4 h-12 w-full text-[15px]")}
      >
        {checking?.state === "checking" ? (
          <>
            <LoaderCircle size={18} className="animate-spin" />
            Checking
          </>
        ) : result?.ok ? (
          <>
            <LoaderCircle size={18} className="animate-spin" />
            Opening
          </>
        ) : checking?.state === "error" ? (
          "Try again"
        ) : (
          "Open video"
        )}
      </button>
      {result?.ok === false && (
        <p className="mt-2 text-center text-sm text-muted">This video cannot be opened here. Paste another link to try one more.</p>
      )}

      <h3 className={cn(EYEBROW, "mt-10")}>How it works</h3>
      <ol className="mt-4 space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3.5">
            <span className={cn(ACCENT, "grid size-7 shrink-0 place-items-center rounded-md text-sm font-black")}>{i + 1}</span>
            <span>
              <span className="block text-[15px] font-semibold">{step.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </form>
  );
}

/** The checks of the video, one row each: what is being looked at, how it went, and what was found. */
function Checks({ checking }: { checking: Checking }) {
  return (
    <ul className="mt-3 space-y-2.5 border-t border-line pt-3">
      {CHECKS.map(({ key, label }) => {
        const step = checking.state === "done" ? checking.result[key] : null;
        return (
          <li key={key} className="flex items-start gap-3 text-sm">
            <StepMark state={checking.state === "checking" ? "checking" : (step?.state ?? "unknown")} />
            <span className="w-20 shrink-0 font-semibold">{label}</span>
            <span className={cn("min-w-0 flex-1", step?.state === "fail" ? "text-rose-300" : "text-muted")}>
              {checking.state === "checking" ? "Checking" : checking.state === "error" ? "Could not be checked" : step?.detail}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StepMark({ state }: { state: CheckStep["state"] | "checking" }) {
  if (state === "checking") return <LoaderCircle size={20} className="shrink-0 animate-spin text-muted" />;
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full",
        state === "ok" ? "bg-emerald-400 text-emerald-950" : state === "fail" ? "bg-rose-400 text-rose-950" : "bg-white/15 text-muted",
      )}
    >
      {state === "ok" ? <Check size={13} strokeWidth={3} /> : state === "fail" ? <X size={13} strokeWidth={3} /> : <Minus size={13} strokeWidth={3} />}
    </span>
  );
}

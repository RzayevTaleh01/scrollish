"use client";

import { Play, X } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useSwipeDown } from "@/lib/swipe";
import type { Level, Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { LevelBadge } from "./LevelBadge";
import { TranscriptSkeleton } from "./Skeleton";
import { SegmentText } from "./SegmentText";

interface LinesProps {
  segments: Segment[] | null;
  current: number;
  showTranslation: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  onSeek: (seconds: number) => void;
  /** Plays one line again, from its first word to its last, and stops there. */
  onReplay: (index: number) => void;
  /** The line being played again, or -1. */
  replaying: number;
}

interface Props extends LinesProps {
  level: Level | null;
  /** The video stops at the end of every line. */
  linePause: boolean;
  onLinePause: () => void;
  /** The word sheet, shown inside the panel. */
  children?: ReactNode;
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The whole transcript next to the video on wide screens, like the side panel of YouTube Shorts.
 * The line being spoken is highlighted and kept in view. The button in front of a line plays just
 * that line again, its time stamp jumps the video there and lets it run on.
 */
export function Transcript({ level, linePause, onLinePause, children, ...lines }: Props) {
  return (
    <aside
      className="glass-soft relative hidden w-[420px] shrink-0 flex-col overflow-hidden rounded-xl lg:ml-4 lg:flex"
      style={{ height: "calc(var(--card-h) + var(--info-h))" }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
        <h2 className="text-lg font-bold">Transcript</h2>
        {level && <LevelBadge level={level} />}
      </div>
      <LinePauseSwitch on={linePause} onToggle={onLinePause} />
      <TranscriptLines {...lines} />
      {children}
    </aside>
  );
}

/**
 * Phones and narrower screens: the same transcript in a sheet from the bottom of the screen, with
 * the video still playing above it. It is put on the page outside the feed, so a swipe on it can
 * never scroll the feed on to the next video. A tap above it or a pull on its top closes it.
 */
export function TranscriptSheet({ level, linePause, onLinePause, onClose, children, ...lines }: Props & { onClose: () => void }) {
  const swipe = useSwipeDown(onClose);
  const { close } = swipe;
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[45]">
      <button
        type="button"
        aria-label="Close transcript"
        onClick={close}
        className={cn(
          "absolute inset-0 bg-black/25 transition-opacity duration-200",
          swipe.closing ? "opacity-0" : "animate-fade-in",
        )}
      />
      {/* As in the word sheet: the outer layer follows the finger, the inner one keeps the rise-in animation. */}
      <div {...swipe.sheet} className="absolute inset-x-0 bottom-0 mx-auto max-w-lg">
        <div
          className="glass-strong animate-rise relative flex h-[62dvh] flex-col overflow-hidden rounded-t-3xl pb-[env(safe-area-inset-bottom)] text-left"
          style={{ "--word-pad": "3px" } as CSSProperties}
        >
          {/* The top of the sheet is what can be pulled down: the lines below it scroll. */}
          <div {...swipe.handle} className="touch-none select-none border-b border-white/10">
            <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 cursor-grab rounded-full bg-white/30" />
            <div className="flex items-center gap-2 py-2 pl-5 pr-3">
              <h2 className="text-lg font-bold">Transcript</h2>
              {level && <LevelBadge level={level} />}
              <button
                type="button"
                aria-label="Close transcript"
                onClick={close}
                className="liquid glass-soft ml-auto grid size-10 place-items-center rounded-full hover:bg-white/15"
              >
                <X size={19} />
              </button>
            </div>
          </div>
          <LinePauseSwitch on={linePause} onToggle={onLinePause} />
          <TranscriptLines {...lines} />
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The switch for stopping the video at the end of every line, above the lines of the transcript. */
function LinePauseSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-3 text-left transition-colors hover:bg-white/5"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Pause after each line</span>
        <span className="mt-0.5 block text-xs text-muted">The video stops when a line ends. Tap it to go on.</span>
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-white/20")}>
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform duration-200",
            on && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

function TranscriptLines({
  segments,
  current,
  showTranslation,
  selection,
  onSelect,
  onSeek,
  onReplay,
  replaying,
}: LinesProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scrolls only the panel: scrollIntoView would also move the video feed.
  useEffect(() => {
    const list = listRef.current;
    if (!list || current < 0) return;
    const row = list.querySelector<HTMLElement>(`[data-row="${current}"]`);
    if (row) list.scrollTo({ top: row.offsetTop - list.clientHeight / 3, behavior: "smooth" });
  }, [current]);

  return (
    <div ref={listRef} className="no-scrollbar relative flex-1 overflow-y-auto overscroll-contain p-2">
      {!segments && <TranscriptSkeleton />}
      {segments?.map((segment, i) => {
        const live = i === current;
        return (
          <div
            key={i}
            data-row={i}
            className={cn(
              "flex gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors",
              live ? "bg-white/10" : "hover:bg-white/5",
            )}
          >
            <button
              type="button"
              title="Play this line again"
              aria-label="Play this line again"
              onClick={() => onReplay(i)}
              className={cn(
                "liquid mt-0.5 grid size-8 shrink-0 place-items-center rounded-full lg:size-7",
                replaying === i ? "bg-accent text-accent-ink" : "glass-soft hover:bg-white/15",
              )}
            >
              <Play size={12} className="ml-0.5 fill-current" />
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSeek(segment.start)}
                className={cn(
                  "text-xs font-semibold tabular-nums transition-colors hover:text-accent",
                  live ? "text-accent" : "text-muted",
                )}
              >
                {clock(segment.start)}
              </button>
              <p className={cn("mt-0.5 text-[15px] leading-6", live ? "text-white" : "text-white/70")}>
                <SegmentText segment={segment} segmentIndex={i} selection={selection} onSelect={onSelect} />
              </p>
              {showTranslation && segment.tr && (
                <p className={cn("mt-1 text-sm leading-5 text-translation", !live && "opacity-70")}>{segment.tr}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

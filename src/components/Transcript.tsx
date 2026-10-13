"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Level, Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { LevelBadge } from "./LevelBadge";
import { TranscriptSkeleton } from "./Skeleton";
import { SegmentText } from "./SegmentText";

interface Props {
  segments: Segment[] | null;
  level: Level | null;
  current: number;
  showTranslation: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  onSeek: (seconds: number) => void;
  /** Plays one line again, from its first word to its last, and stops there. */
  onReplay: (index: number) => void;
  /** The line being played again, or -1. */
  replaying: number;
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
export function Transcript({
  segments,
  level,
  current,
  showTranslation,
  selection,
  onSelect,
  onSeek,
  onReplay,
  replaying,
  children,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scrolls only the panel: scrollIntoView would also move the video feed.
  useEffect(() => {
    const list = listRef.current;
    if (!list || current < 0) return;
    const row = list.querySelector<HTMLElement>(`[data-row="${current}"]`);
    if (row) list.scrollTo({ top: row.offsetTop - list.clientHeight / 3, behavior: "smooth" });
  }, [current]);

  return (
    <aside
      className="glass-soft relative hidden w-[420px] shrink-0 flex-col overflow-hidden rounded-xl lg:ml-4 lg:flex"
      style={{ height: "var(--card-h)" }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
        <h2 className="text-lg font-bold">Transcript</h2>
        {level && <LevelBadge level={level} />}
      </div>

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
                  "liquid mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
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

      {children}
    </aside>
  );
}

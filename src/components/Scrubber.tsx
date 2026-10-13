"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { cn } from "@/lib/cn";

export interface ScrubberHandle {
  /** Where the video is. Written straight to the line: it changes several times a second. */
  update: (time: number, duration: number) => void;
}

interface Props {
  handle: RefObject<ScrubberHandle | null>;
  onSeek: (seconds: number) => void;
  className?: string;
}

/** Seconds as the player shows them: 0:07, 1:24. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const KEY_STEP = 5;

/**
 * The timeline along the bottom edge of the video, a thin line as on YouTube and TikTok. The strip
 * it lies in is taller than the line, so a finger catches it: a tap goes to that moment, a drag
 * shows the time over the video as it goes and jumps there when the finger lifts.
 */
export function SeekLine({ handle, onSeek, className }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const timeLabel = useRef<HTMLSpanElement>(null);
  const durationLabel = useRef<HTMLSpanElement>(null);
  const duration = useRef(0);
  const time = useRef(0);
  const dragging = useRef(false);

  const draw = useCallback((seconds: number) => {
    const fraction = duration.current ? Math.min(Math.max(seconds / duration.current, 0), 1) : 0;
    const percent = `${fraction * 100}%`;
    if (fill.current) fill.current.style.width = percent;
    if (thumb.current) thumb.current.style.left = percent;
    if (timeLabel.current) timeLabel.current.textContent = clock(seconds);
    track.current?.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
    track.current?.setAttribute("aria-valuetext", clock(seconds));
  }, []);

  useEffect(() => {
    handle.current = {
      update: (seconds, total) => {
        if (total > 0 && total !== duration.current) {
          duration.current = total;
          if (durationLabel.current) durationLabel.current.textContent = clock(total);
        }
        time.current = seconds;
        if (!dragging.current) draw(seconds);
      },
    };
    return () => {
      handle.current = null;
    };
  }, [handle, draw]);

  const secondsAt = (e: PointerEvent) => {
    const rect = track.current!.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) * duration.current;
  };

  const stopDragging = () => {
    dragging.current = false;
    delete track.current?.dataset.dragging;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!duration.current) return;
    dragging.current = true;
    e.currentTarget.dataset.dragging = "";
    e.currentTarget.setPointerCapture(e.pointerId);
    draw(secondsAt(e));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) draw(secondsAt(e));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const seconds = secondsAt(e);
    stopDragging();
    time.current = seconds;
    onSeek(seconds);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? KEY_STEP : e.key === "ArrowLeft" ? -KEY_STEP : 0;
    if (!step || !duration.current) return;
    e.preventDefault();
    const seconds = Math.min(Math.max(time.current + step, 0), duration.current);
    draw(seconds);
    onSeek(seconds);
  };

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={stopDragging}
      onKeyDown={onKeyDown}
      className={cn("group absolute inset-x-0 bottom-0 z-30 h-4 cursor-pointer touch-none outline-none md:h-6", className)}
    >
      {/* While dragging: the time the finger is at, over the video. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-data-[dragging]:opacity-100">
        <span className="glass-card inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold tabular-nums">
          <span ref={timeLabel}>0:00</span>
          <span className="text-muted">/</span>
          <span ref={durationLabel} className="text-muted">
            0:00
          </span>
        </span>
      </div>
      {/* Along the seam between the video and the channel row under it, from edge to edge. */}
      <div className="absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25 transition-[height] duration-150 group-hover:h-[5px] group-data-[dragging]:h-[5px]">
          {/* Eased between the readings of the clock, but not under a finger, which it must follow at once. */}
          <div
            ref={fill}
            className="h-full w-0 bg-accent transition-[width] duration-150 ease-linear group-data-[dragging]:transition-none"
          />
        </div>
        <div
          ref={thumb}
          className="pointer-events-none absolute bottom-[-2px] left-0 size-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow-[0_1px_4px_rgb(0_0_0/0.5)] transition-[opacity,scale,left] duration-150 ease-linear group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[dragging]:scale-125 group-data-[dragging]:opacity-100 group-data-[dragging]:transition-[opacity,scale]"
        />
      </div>
    </div>
  );
}

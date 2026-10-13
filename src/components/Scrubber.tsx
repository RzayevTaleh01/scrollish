"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { ACCENT, BAR } from "./brand";
import { formatSpeed } from "./SpeedSheet";

export interface ScrubberHandle {
  /** Where the video is. Written straight to the bar: it changes several times a second. */
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
 * Phones: the seek bar under the video. A tap goes to that moment; a drag shows the time
 * as it goes and jumps there when the finger lifts.
 */
export function Scrubber({ handle, onSeek, className }: Props) {
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
    <div className={cn("flex items-center gap-2.5 px-1", className)}>
      <span ref={timeLabel} className="w-8 text-right text-[11px] font-medium tabular-nums text-muted">
        0:00
      </span>
      {/* Taller than it looks, so it is easy to catch with a finger. */}
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
        className="group relative flex h-full flex-1 cursor-pointer touch-none items-center outline-none"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150 group-data-[dragging]:h-1.5">
          <div ref={fill} className="h-full w-0 rounded-full bg-accent" />
        </div>
        <div
          ref={thumb}
          className="pointer-events-none absolute left-0 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.5)] transition-[scale] duration-150 group-focus-visible:ring-2 group-focus-visible:ring-accent group-data-[dragging]:scale-150"
        />
      </div>
      <span ref={durationLabel} className="w-8 text-[11px] font-medium tabular-nums text-muted">
        0:00
      </span>
    </div>
  );
}

function BarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "liquid grid h-8 min-w-9 shrink-0 place-items-center rounded-lg px-1.5",
        active ? ACCENT : "text-white hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

interface BarProps extends Props {
  muted: boolean;
  speed: number;
  onMute: () => void;
  onSpeed: () => void;
}

/**
 * Phones: the bar under the video, a flat tile like the navigation bar.
 * The sound on the left, the timeline in the middle, the speed on the right.
 */
export function PlayerBar({ muted, speed, onMute, onSpeed, className, ...scrubber }: BarProps) {
  return (
    <div className={cn("flex h-[var(--seek-h)] items-center", className)}>
      <div className={cn(BAR, "flex h-10 min-w-0 flex-1 items-center gap-1 px-1")}>
        <BarButton label={muted ? "Unmute" : "Mute"} onClick={onMute}>
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </BarButton>
        <Scrubber {...scrubber} className="h-full min-w-0 flex-1" />
        <BarButton label={`Speed, now ${formatSpeed(speed)}`} active={speed !== 1} onClick={onSpeed}>
          <span className="text-[13px] font-bold tabular-nums">{formatSpeed(speed)}</span>
        </BarButton>
      </div>
    </div>
  );
}

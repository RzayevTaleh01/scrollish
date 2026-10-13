"use client";

import { Minus, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { usePresence } from "@/lib/presence";

/** The range YouTube's player can play at. It takes any speed in between, in steps of 0.05. */
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 2;
const SPEED_STEP = 0.05;

/** A speed kept inside the range and on a step, without the stray decimals arithmetic leaves behind. */
export function tidySpeed(speed: number): number {
  const stepped = Math.round(speed / SPEED_STEP) * SPEED_STEP;
  return Number(Math.min(SPEED_MAX, Math.max(SPEED_MIN, stepped)).toFixed(2));
}

export const formatSpeed = (speed: number) => `${speed}×`;

interface Props {
  open: boolean;
  speed: number;
  onChange: (speed: number) => void;
  onClose: () => void;
}

/**
 * The viewer's own speed for the videos: a slider over the whole range rather than a list of fixed
 * speeds, with two buttons for one step at a time. The video keeps playing while it is open, so
 * the change is heard at once.
 */
export function SpeedSheet({ open, speed, onChange, onClose }: Props) {
  const { mounted, closing } = usePresence(open);
  if (!mounted) return null;

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 z-30" />
      <div
        className={cn(
          "glass-strong absolute inset-x-0 bottom-0 z-40 rounded-t-3xl px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 text-left",
          closing ? "pointer-events-none animate-sink" : "animate-rise",
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">Speed</h3>
          <SheetButton label="Close" onClick={onClose}>
            <X size={19} />
          </SheetButton>
        </div>

        <div className="mt-1 flex items-center gap-3">
          <SheetButton label="Slower" onClick={() => onChange(tidySpeed(speed - SPEED_STEP))}>
            <Minus size={19} />
          </SheetButton>
          <p className="flex-1 text-center text-4xl font-bold tabular-nums">{formatSpeed(speed)}</p>
          <SheetButton label="Faster" onClick={() => onChange(tidySpeed(speed + SPEED_STEP))}>
            <Plus size={19} />
          </SheetButton>
        </div>

        <input
          type="range"
          aria-label="Playback speed"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={SPEED_STEP}
          value={speed}
          onChange={(e) => onChange(tidySpeed(Number(e.target.value)))}
          className="mt-5 w-full accent-[var(--accent)]"
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>{formatSpeed(SPEED_MIN)}</span>
          <button
            type="button"
            onClick={() => onChange(1)}
            className="liquid glass-soft rounded-full px-3 py-1 font-semibold text-white hover:bg-white/15"
          >
            Normal speed
          </button>
          <span>{formatSpeed(SPEED_MAX)}</span>
        </div>
      </div>
    </>
  );
}

function SheetButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="liquid glass-soft grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/15"
    >
      {children}
    </button>
  );
}

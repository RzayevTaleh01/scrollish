"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { LogoMark, Wordmark } from "./Logo";

export function Splash({ open, onStart }: { open: boolean; onStart: () => void }) {
  const [mounted, setMounted] = useState(true);
  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-8 text-center transition-opacity duration-300",
        !open && "pointer-events-none opacity-0",
      )}
      onTransitionEnd={() => !open && setMounted(false)}
    >
      <div className="animate-rise flex flex-col items-center">
        <LogoMark size={84} />
        <h1 className="mt-7 text-4xl">
          <Wordmark />
        </h1>
        <p className="mt-3 max-w-[280px] text-[15px] leading-relaxed text-muted">
          Scroll short videos. Tap any word or phrase in the subtitles to learn it.
        </p>

        <button
          onClick={onStart}
          className="liquid mt-12 inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-10 text-base font-semibold text-black"
        >
          <Play size={18} className="fill-current" />
          Start
        </button>
        <p className="mt-5 text-xs text-muted">One tap lets the videos play with sound.</p>
      </div>
    </div>
  );
}

"use client";

import { ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { FeedPending } from "@/lib/types";
import { Cover } from "./Cover";
import { LevelBadge } from "./LevelBadge";
import { LogoMark } from "./Logo";

/** A card of the size and place of the video, for whatever is shown while there is no video. */
export function CardFrame({ children, pulse }: { children?: ReactNode; pulse?: boolean }) {
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center pt-[var(--top)]">
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] bg-surface px-8 text-center md:rounded-3xl",
          pulse && "animate-pulse",
        )}
        style={{ width: "var(--card-w)", height: "var(--card-h)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** What happens to a video while it is prepared, in the order the animation plays it. */
const STEPS = ["Reading the subtitles", "Translating every line", "Explaining every word"];
/** Widths of the bars that stand for the words of one subtitle line. */
const WORDS = [28, 44, 20, 54, 32];
/** The word that gets picked out and explained. */
const PICKED = 3;

/** Sets when a part of the animation starts, in seconds into its loop. */
const at = (seconds: number) => ({ "--at": `${seconds}s` }) as CSSProperties;

/**
 * Shown while a video is being analysed. The animation plays out what Scrollish makes of a video:
 * a subtitle line appears word by word, its translation is drawn in under it, then one word is
 * picked out and gets its meaning and level. It loops for as long as the wait lasts, so it shows
 * what is being done, not how far along it is. The timing lives in globals.css (prep-*).
 */
export function Preparing({ pending, onSkip }: { pending: FeedPending | null; onSkip: () => void }) {
  const video = pending?.video;
  // Something is in the way and it will be tried again later: the viewer should not be left waiting on it.
  const delayed = Boolean(video && pending?.error);

  return (
    <CardFrame>
      {/* The video that is being waited for, dimmed, so it is clear which one this is about. */}
      {video && <Cover key={video} id={video} className="opacity-20" />}

      <div className="relative flex flex-col items-center">
        <div className="relative grid size-[84px] place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-accent [animation-duration:1.4s]" />
          <LogoMark size={52} />
        </div>

        <div aria-hidden className="glass relative mt-12 w-[240px] rounded-2xl px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            {WORDS.map((width, i) => (
              <span key={i} style={{ width, ...at(i * 0.25) }} className="prep-word relative h-2.5 shrink-0">
                <span className={cn("block size-full rounded-full bg-white/85", i === PICKED && "prep-pick")} />
                {i === PICKED && (
                  <span className="prep-tip glass-strong absolute bottom-[calc(100%+10px)] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg px-2 py-1.5">
                    <LevelBadge level="B1" />
                    <span className="h-1.5 w-9 rounded-full bg-translation" />
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="mt-2.5 border-t border-white/15 pt-2.5">
            <span className="prep-line block h-2 w-[150px] rounded-full bg-translation" />
          </div>
        </div>

        <p className="mt-7 text-lg font-semibold">
          {delayed ? "This video is not ready yet" : video ? "Preparing this video" : "Preparing your videos"}
        </p>
        <div className="relative mt-1.5 h-5 w-64">
          {STEPS.map((step, i) => (
            <p key={step} style={at(i * 2)} className="prep-step absolute inset-0 text-sm font-medium text-accent">
              {step}
            </p>
          ))}
        </div>
        <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-muted">
          {video
            ? "Nobody has opened it here before. This is done once and takes about a minute, then it opens instantly for everyone."
            : "The first videos are analysed once, a few at a time. That takes about a minute, then they open instantly."}
        </p>
        {pending?.error && (
          <p className="glass mt-4 max-w-[280px] rounded-xl px-3 py-2 text-xs leading-relaxed text-rose-200">
            {pending.error}
          </p>
        )}
        {video && (
          <button
            onClick={onSkip}
            className={cn(
              "liquid mt-5 inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold",
              delayed ? "bg-white text-black" : "glass-soft hover:bg-white/15",
            )}
          >
            Watch other videos
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </CardFrame>
  );
}

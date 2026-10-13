import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { TILE } from "./brand";

/** A grey block in the shape of something that is still loading. Give it its rounding with the size. */
export function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cn("skeleton block", className)} style={style} />;
}

/**
 * The feed before its first videos arrive: a slide drawn in grey, in the place and the size of the
 * real one, so the videos fade in over their own outline instead of popping into an empty page.
 */
export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading videos" className="absolute inset-0 z-10 flex items-start justify-center pt-[var(--top)]">
      <div className="flex items-end gap-4">
        <div className="flex w-[var(--card-w)] shrink-0 flex-col">
          <div
            className="relative overflow-hidden rounded-t-xl bg-surface md:rounded-t-2xl"
            style={{ width: "var(--card-w)", height: "var(--card-h)" }}
          >
            {/* Phones: the buttons down the right side of the video, over the room kept for the subtitles. */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-3 pb-5 md:px-4 md:pb-7">
              <div className="flex flex-col gap-3 self-end md:hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Bone key={i} className="size-11 rounded-full" />
                ))}
              </div>
              <div className="flex min-h-[116px] flex-col justify-end">
                <Bone className="h-[58px] w-[78%] rounded-xl" />
              </div>
            </div>
          </div>
          {/* The channel row joined under the video, a faint line where the timeline will be. */}
          <div className="flex h-[var(--info-h)] items-center gap-3 rounded-b-xl border-t border-white/[0.06] bg-surface pl-3 md:rounded-b-2xl md:px-4">
            <Bone className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bone className="h-3 w-28 rounded-md" />
              <Bone className="h-2.5 w-44 rounded-md" />
            </div>
          </div>
        </div>
        {/* Desktop: the buttons beside the video. */}
        <div className="hidden flex-col gap-3 md:flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className="size-12 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A dictionary entry while the list is loading. */
export function EntrySkeleton() {
  return (
    <li aria-hidden className={cn(TILE, "flex items-center gap-3 px-4 py-3.5")}>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Bone className="h-4 w-24 rounded-md" />
          <Bone className="h-3 w-10 rounded-md" />
        </div>
        <Bone className="h-3.5 w-40 rounded-md" />
      </div>
      <Bone className="size-4 rounded-full" />
    </li>
  );
}

/** The transcript beside the video on wide screens, while its lines load. */
export function TranscriptSkeleton() {
  return (
    <div aria-hidden className="space-y-1 p-0.5">
      {[78, 64, 88, 56, 72, 84, 60].map((width, i) => (
        <div key={i} className="flex gap-2.5 px-2.5 py-2.5">
          <Bone className="h-3 w-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 rounded-md" style={{ width: `${width}%` }} />
            <Bone className="h-3 rounded-md" style={{ width: `${width - 18}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

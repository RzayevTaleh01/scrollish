"use client";

import { Heart, X } from "lucide-react";
import { useEffect } from "react";
import { languageOf, isLanguageId } from "@/lib/languages";
import type { LikedVideo } from "@/lib/liked";
import { LevelBadge } from "./LevelBadge";

interface Props {
  items: LikedVideo[];
  onOpen: (video: LikedVideo) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

/** Liked videos, newest first. Kept in this browser until there are accounts. */
export function Liked({ items, onOpen, onRemove, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="animate-fade-in fixed inset-0 z-40 flex flex-col bg-black/75 backdrop-blur-2xl backdrop-saturate-150">
      <div className="no-scrollbar mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Liked videos</h2>
          <button
            onClick={onClose}
            aria-label="Close liked videos"
            className="liquid glass-soft grid size-10 place-items-center rounded-full hover:bg-white/15"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Saved in this browser.</p>

        {items.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted">
            Nothing here yet. Tap the heart on a video to keep it in this list.
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((video) => (
              <li key={video.id} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(video)}
                  className="liquid block w-full text-left"
                >
                  <span className="relative block aspect-[9/16] overflow-hidden rounded-2xl bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="size-full object-cover"
                    />
                    <span className="absolute left-2 top-2 flex items-center gap-1.5">
                      {isLanguageId(video.lang) && (
                        <span className="glass rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
                          {languageOf(video.lang).label}
                        </span>
                      )}
                      {video.level && <LevelBadge level={video.level} />}
                    </span>
                  </span>
                  {video.title && <span className="mt-2 line-clamp-2 text-sm font-semibold">{video.title}</span>}
                  {video.channelTitle && <span className="mt-0.5 block truncate text-xs text-muted">{video.channelTitle}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(video.id)}
                  aria-label="Remove from liked"
                  title="Remove from liked"
                  className="liquid glass absolute right-2 top-2 grid size-9 place-items-center rounded-full"
                >
                  <Heart size={17} className="fill-rose-500 text-rose-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

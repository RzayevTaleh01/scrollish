"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { FeedItem } from "@/lib/types";
import { LevelBadge } from "./LevelBadge";
import { formatSpeed } from "./SpeedSheet";

function Avatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // A grey disc until the picture arrives, then the picture fades in.
    <span className={cn("relative size-9 shrink-0 overflow-hidden rounded-full", !loaded && "skeleton")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(img) => {
          if (img?.complete && img.naturalWidth && !loaded) setLoaded(true);
        }}
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn("size-full transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </span>
  );
}

interface Props {
  item: FeedItem;
  muted: boolean;
  /** Playback speed the viewer chose, 1 being normal. */
  speed: number;
  onMute: () => void;
  /** Opens the speed slider. */
  onSpeed: () => void;
}

/**
 * Under the video and joined to it, the bottom of the same card: the channel's picture and name with
 * the level of the video, and the title below them, all of it a link to the video on YouTube (on a
 * phone, usually the YouTube app). On phones the speed and sound buttons are at the end of the row,
 * off the video; wide screens have them with the buttons beside the video.
 */
export function VideoInfo({ item, muted, speed, onMute, onSpeed }: Props) {
  return (
    <div className="flex h-[var(--info-h)] items-center gap-1 rounded-b-xl bg-surface pl-3 pr-1.5 md:rounded-b-2xl md:px-4">
      <a
        href={`https://www.youtube.com/shorts/${item.id}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Open on YouTube"
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1"
      >
        <Avatar key={item.avatar} src={item.avatar} name={item.channelTitle} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold group-hover:underline">{item.channelTitle}</span>
            {item.level && <LevelBadge level={item.level} className="shrink-0" />}
          </span>
          {item.title && <span className="mt-0.5 block truncate text-xs text-muted">{item.title}</span>}
        </span>
      </a>
      <button
        type="button"
        title={`Speed, now ${formatSpeed(speed)}`}
        aria-label={`Speed, now ${formatSpeed(speed)}`}
        onClick={onSpeed}
        className={cn(
          "liquid grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-1 text-[13px] font-bold tabular-nums md:hidden",
          speed !== 1 ? "bg-accent text-accent-ink" : "hover:bg-white/10",
        )}
      >
        {formatSpeed(speed)}
      </button>
      <button
        type="button"
        title={muted ? "Unmute" : "Mute"}
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={onMute}
        className="liquid grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/10 md:hidden"
      >
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
    </div>
  );
}

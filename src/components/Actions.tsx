"use client";

import { Heart, Languages, Share2, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function IconButton({
  label,
  active,
  activeClass,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  activeClass?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "liquid grid size-11 place-items-center rounded-full md:size-12",
        // Glass over the video on phones, a soft tile on the page background on desktop.
        active && activeClass ? activeClass : "glass text-white md:glass-soft",
      )}
    >
      {children}
    </button>
  );
}

interface Props {
  liked: boolean;
  translation: boolean;
  muted: boolean;
  onLike: () => void;
  onTranslation: () => void;
  onMute: () => void;
  onShare: () => void;
  className?: string;
}

export function Actions({ liked, translation, muted, onLike, onTranslation, onMute, onShare, className }: Props) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <IconButton label="Like" onClick={onLike}>
        <Heart size={22} className={liked ? "fill-rose-500 text-rose-500" : ""} />
      </IconButton>
      <IconButton
        label={translation ? "Hide Azerbaijani translation" : "Show Azerbaijani translation"}
        active={translation}
        activeClass="bg-accent text-accent-ink"
        onClick={onTranslation}
      >
        <Languages size={21} />
      </IconButton>
      <IconButton label={muted ? "Unmute" : "Mute"} onClick={onMute}>
        {muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
      </IconButton>
      <IconButton label="Share" onClick={onShare}>
        <Share2 size={20} />
      </IconButton>
    </div>
  );
}

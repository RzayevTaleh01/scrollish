"use client";

import { Heart, Languages, Share2, Volume2, VolumeX } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatSpeed } from "./SpeedSheet";

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
        // A little smaller on short phones, where the column has to fit above the subtitles.
        "liquid grid size-11 place-items-center rounded-full max-md:short:size-10 md:size-12",
        // Clear glass over the video on phones, a soft tile on the page background on desktop.
        active && activeClass ? activeClass : "max-md:glass-button md:glass-soft",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The transcript button's icon: sound on the left and the lines of text it becomes on the right,
 * which is what a transcript is. Drawn like the lucide icons around it.
 */
function TranscriptIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 10v4M6.5 7v10M10 9.5v5" />
      <path d="M14 7h7M14 12h6M14 17h4" />
    </svg>
  );
}

/** Where the sparks of a like fly to, as steps round the heart, and which of the app's colors each takes. */
const SPARKS = [0, 60, 120, 180, 240, 300].map((degrees, i) => ({
  x: Math.round(Math.cos((degrees * Math.PI) / 180) * 26),
  y: Math.round(Math.sin((degrees * Math.PI) / 180) * 26),
  color: ["bg-rose-500", "bg-translation", "bg-accent"][i % 3],
}));

interface Props {
  liked: boolean;
  translation: boolean;
  muted: boolean;
  speed: number;
  onLike: () => void;
  onTranslation: () => void;
  onMute: () => void;
  /** Opens the speed slider. */
  onSpeed: () => void;
  onShare: () => void;
  /** Opens the transcript. Without it there is no transcript button: wide screens show it beside the video. */
  onTranscript?: () => void;
  transcriptOpen?: boolean;
  /** With the sound and speed buttons. Phones have them in the row under the video instead. */
  playback?: boolean;
  className?: string;
}

export function Actions({
  liked,
  translation,
  muted,
  speed,
  onLike,
  onTranslation,
  onMute,
  onSpeed,
  onShare,
  onTranscript,
  transcriptOpen = false,
  playback = true,
  className,
}: Props) {
  // Only a press that likes the video sets it off: not taking a like back, and not a slide
  // that arrives showing a video liked earlier.
  const [bursting, setBursting] = useState(false);

  const like = () => {
    if (!liked) setBursting(true);
    onLike();
  };

  return (
    <div className={cn("flex items-center gap-3 max-md:short:gap-2", className)}>
      <IconButton label={liked ? "Unlike" : "Like"} active={liked} onClick={like}>
        <span className="relative grid place-items-center">
          <Heart size={22} className={cn(liked && "fill-rose-500 text-rose-500", bursting && "like-pop")} />
          {bursting && (
            <>
              {/* The ring is the last to finish, so it is the one that clears the burst away. */}
              <span
                onAnimationEnd={() => setBursting(false)}
                className="like-ring pointer-events-none absolute size-9 rounded-full border-2 border-rose-500"
              />
              {SPARKS.map((spark, i) => (
                <span
                  key={i}
                  style={{ "--dx": `${spark.x}px`, "--dy": `${spark.y}px` } as CSSProperties}
                  className={cn("like-spark pointer-events-none absolute size-1.5 rounded-full", spark.color)}
                />
              ))}
            </>
          )}
        </span>
      </IconButton>
      <IconButton
        label={translation ? "Hide Azerbaijani translation" : "Show Azerbaijani translation"}
        active={translation}
        activeClass="bg-accent text-accent-ink"
        onClick={onTranslation}
      >
        <Languages size={21} />
      </IconButton>
      {onTranscript && (
        <IconButton label="Transcript" active={transcriptOpen} onClick={onTranscript}>
          <TranscriptIcon />
        </IconButton>
      )}
      {playback && (
        <>
          <IconButton label={muted ? "Unmute" : "Mute"} onClick={onMute}>
            {muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
          </IconButton>
          <IconButton
            label={`Speed, now ${formatSpeed(speed)}`}
            active={speed !== 1}
            activeClass="bg-accent text-accent-ink"
            onClick={onSpeed}
          >
            <span className="text-[13px] font-bold tabular-nums">{formatSpeed(speed)}</span>
          </IconButton>
        </>
      )}
      <IconButton label="Share" onClick={onShare}>
        <Share2 size={20} />
      </IconButton>
    </div>
  );
}

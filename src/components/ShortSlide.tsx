"use client";

import { Play } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useVideoContent } from "@/lib/content";
import { useMediaQuery, WIDE_QUERY } from "@/lib/media";
import type { FeedItem, Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { Actions } from "./Actions";
import { LevelBadge } from "./LevelBadge";
import { OVERLAY_CARD, OVERLAY_PRIMARY_TEXT, OVERLAY_SECONDARY_TEXT } from "./overlay";
import { ShortPlayer, type PlayerControls } from "./ShortPlayer";
import { Subtitles } from "./Subtitles";
import { Transcript } from "./Transcript";
import { WordSheet } from "./WordSheet";

interface Props {
  item: FeedItem;
  /** Place of this slide in the feed list, reported to the feed when the slide scrolls into view. */
  position: number;
  active: boolean;
  mountPlayer: boolean;
  muted: boolean;
  translation: boolean;
  liked: boolean;
  onLike: (item: FeedItem) => void;
  onTranslation: () => void;
  onMute: () => void;
  onShare: (item: FeedItem) => void;
  /** Told whether the slide on screen is playing, so the feed can tuck its header away. */
  onPlayback: (playing: boolean) => void;
}

function findSegment(segments: Segment[], time: number): number {
  let found = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start <= time + 0.15) found = i;
    else break;
  }
  if (found === -1) return -1;
  // Keep the last line on screen a moment after it ends.
  return time <= segments[found].end + 1.2 ? found : -1;
}

function Avatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-8 shrink-0 rounded-full bg-white/20"
    />
  );
}

export const ShortSlide = memo(function ShortSlide({
  item,
  position,
  active,
  mountPlayer,
  muted,
  translation,
  liked,
  onLike,
  onTranslation,
  onMute,
  onShare,
  onPlayback,
}: Props) {
  const content = useVideoContent(item.id, mountPlayer);
  const contentRef = useRef(content);
  const resumeRef = useRef(false);
  const controls = useRef<PlayerControls | null>(null);
  /** Wide screens show the transcript beside the video instead of subtitles on it. */
  const wide = useMediaQuery(WIDE_QUERY);

  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(-1);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    if (!mountPlayer) {
      setPlaying(false);
      setPaused(false);
      setProgress(0);
      setSegmentIndex(-1);
      setSelection(null);
    }
  }, [mountPlayer]);

  const isPlaying = active && playing && !paused;
  useEffect(() => {
    if (active) onPlayback(isPlaying);
  }, [active, isPlaying, onPlayback]);

  const handleTime = useCallback((time: number, duration: number) => {
    setProgress(time / duration);
    const segments = contentRef.current?.segments;
    setSegmentIndex(segments ? findSegment(segments, time) : -1);
  }, []);

  const select = (next: Selection) => {
    if (!selection) {
      resumeRef.current = !paused;
      setPaused(true);
    }
    setSelection(next);
  };

  const closeSheet = () => {
    setSelection(null);
    if (resumeRef.current) setPaused(false);
  };

  const seek = (seconds: number) => {
    controls.current?.seek(seconds);
    if (!selection) setPaused(false);
  };

  const segment = content && segmentIndex >= 0 ? content.segments[segmentIndex] : null;
  const selectedSegment = content && selection ? content.segments[selection.segment] : null;

  const sheet = selection && selectedSegment && (
    <>
      <button type="button" aria-label="Close" onClick={closeSheet} className="absolute inset-0 z-30 bg-black/35" />
      <WordSheet
        segment={selectedSegment}
        selection={selection}
        videoId={item.id}
        onSelect={setSelection}
        onClose={closeSheet}
      />
    </>
  );

  const actions = {
    liked,
    translation,
    muted,
    onLike: () => onLike(item),
    onTranslation,
    onMute,
    onShare: () => onShare(item),
  };

  return (
    <section
      data-slide
      data-index={position}
      className="flex h-full shrink-0 snap-start snap-always items-start justify-center pt-[var(--top)]"
    >
      {/*
        Video on the left, then the action column and, on wide screens, the transcript pushed to the
        right edge of a slightly wider centred row, so there is open space between them.
        The right padding keeps the transcript clear of the feed's up/down buttons on narrower screens.
      */}
      <div className="mx-auto flex w-full max-w-[61rem] items-end justify-center gap-4 md:px-4 lg:pr-[max(1rem,calc(88px_-_(100vw_-_61rem)/2))]">
        <div
          className="relative overflow-hidden md:overflow-visible"
          style={{ width: "var(--card-w)", height: "var(--card-h)" }}
        >
          {/* Ambient glow, like YouTube: the video's own colors, blurred, spilling out behind it. */}
          {mountPlayer && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 aspect-[9/16] w-full scale-105 object-cover opacity-25 blur-3xl"
            />
          )}
          <div className="relative size-full">
            {/* The 9:16 video, filling the whole card on phones. */}
            <div
              className="absolute overflow-hidden bg-black md:rounded-3xl"
              style={{
                width: "var(--video-w)",
                height: "var(--video-h)",
                left: "calc((var(--card-w) - var(--video-w)) / 2)",
                top: "calc((var(--card-h) - var(--video-h)) / 2)",
              }}
            >
              {mountPlayer && (
                <ShortPlayer
                  videoId={item.id}
                  controls={controls}
                  active={active}
                  paused={paused}
                  muted={muted}
                  onPlaying={() => setPlaying(true)}
                  onPausedChange={setPaused}
                  onTime={handleTime}
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
                alt=""
                draggable={false}
                className={cn(
                  "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-300",
                  playing ? "opacity-0" : "opacity-100",
                )}
              />
            </div>

            {/*
              Phones: YouTube draws the channel, title, like and share along the bottom of the video.
              The same light blur as the top band covers them, under our own cards.
            */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[calc(env(safe-area-inset-bottom)+80px)] backdrop-blur-md backdrop-saturate-150 md:hidden"
            />

            <button
              type="button"
              aria-label={paused ? "Play video" : "Pause video"}
              onClick={() => setPaused((p) => !p)}
              className="absolute inset-0 z-10"
            />
            {paused && !selection && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                <span className="glass grid size-[72px] place-items-center rounded-full">
                  <Play size={30} className="ml-1 fill-white" />
                </span>
              </div>
            )}

            {/* Right padding on phones leaves room for the action buttons. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 pb-[calc(14px+env(safe-area-inset-bottom))] pl-3 pr-[72px] md:px-4 md:pb-4">
              {segment && !wide && (
                <Subtitles
                  segment={segment}
                  segmentIndex={segmentIndex}
                  showTranslation={translation}
                  selection={selection}
                  onSelect={select}
                />
              )}
              <div className={cn(OVERLAY_CARD, "flex items-center gap-2.5 py-2 pl-2 pr-3.5")}>
                <Avatar src={item.avatar} name={item.channelTitle} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(OVERLAY_PRIMARY_TEXT, "truncate")}>{item.channelTitle}</span>
                    {item.level && <LevelBadge level={item.level} className="shrink-0" />}
                  </div>
                  <p className={cn(OVERLAY_SECONDARY_TEXT, "truncate text-white/75")}>{item.title}</p>
                </div>
              </div>
            </div>

            <Actions
              {...actions}
              className="absolute bottom-[calc(76px+env(safe-area-inset-bottom))] right-3 z-20 flex-col md:hidden"
            />

            <div className="absolute inset-x-0 bottom-0 z-30 h-[3px] bg-white/25">
              <div
                className="h-full bg-accent transition-[width] duration-150 ease-linear"
                style={{ width: `${Math.min(progress, 1) * 100}%` }}
              />
            </div>

            {!wide && sheet}
          </div>
        </div>

        <Actions {...actions} className="hidden flex-col md:flex" />

        <Transcript
          segments={content?.segments ?? null}
          level={content?.level ?? item.level}
          current={segmentIndex}
          showTranslation={translation}
          selection={selection}
          onSelect={select}
          onSeek={seek}
        >
          {wide && sheet}
        </Transcript>
      </div>
    </section>
  );
});

"use client";

import { Loader2, Play, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useVideoContent } from "@/lib/content";
import { useMediaQuery, WIDE_QUERY } from "@/lib/media";
import type { FeedItem, Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { Actions } from "./Actions";
import { Cover } from "./Cover";
import { LevelBadge } from "./LevelBadge";
import { OVERLAY_CARD, OVERLAY_PRIMARY_TEXT, OVERLAY_SECONDARY_TEXT } from "./overlay";
import { ShortPlayer, type PlayerControls } from "./ShortPlayer";
import { Subtitles } from "./Subtitles";
import { Transcript } from "./Transcript";
import { WordSheet } from "./WordSheet";

interface Props {
  /** The video this slide shows now. The feed reuses its few slides, so this changes as the viewer moves on. */
  item: FeedItem;
  /** Place of this slide in the feed list, reported to the feed when the slide scrolls into view. */
  position: number;
  active: boolean;
  /** Asks the slide to wait before loading its video, so the video on screen loads first. */
  hold: boolean;
  /** This is the slide on screen, whether or not it is allowed to play yet. */
  current: boolean;
  /** How long to wait before building the player for the first time, so the players are not all built at once. */
  buildDelay: number;
  muted: boolean;
  /** Nothing has been tapped yet, so the browser only lets videos play silently: the next tap is for sound. */
  soundLocked: boolean;
  translation: boolean;
  liked: boolean;
  onLike: (item: FeedItem) => void;
  onTranslation: () => void;
  onMute: () => void;
  onShare: (item: FeedItem) => void;
  /** Told whether the slide on screen is playing, so the feed can tuck its header away. */
  onPlayback: (playing: boolean) => void;
  /** Told once the video of the slide on screen is under way: the cue to load the other videos. */
  onSettled: (position: number) => void;
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
  hold,
  current,
  buildDelay,
  muted,
  soundLocked,
  translation,
  liked,
  onLike,
  onTranslation,
  onMute,
  onShare,
  onPlayback,
  onSettled,
}: Props) {
  const content = useVideoContent(item.id);
  const contentRef = useRef(content);
  const resumeRef = useRef(false);
  const controls = useRef<PlayerControls | null>(null);
  /** Wide screens show the transcript beside the video instead of subtitles on it. */
  const wide = useMediaQuery(WIDE_QUERY);

  const [shownId, setShownId] = useState(item.id);
  /** The video the player has been given. It trails `item` while the slide is asked to hold. */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  /** The player exists. Building one is heavy work for the browser, which the video that is playing would feel. */
  const [built, setBuilt] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** The video has stopped to load more. */
  const [buffering, setBuffering] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(-1);
  const [selection, setSelection] = useState<Selection | null>(null);

  // Handed another video: everything that belonged to the previous one is dropped. The player stays.
  if (shownId !== item.id) {
    setShownId(item.id);
    setPlaying(false);
    setBuffering(false);
    setPaused(false);
    setProgress(0);
    setSegmentIndex(-1);
    setSelection(null);
  }
  // Done while rendering, so the player never plays the previous video as if it were this one.
  if (!hold && loadedId !== item.id) setLoadedId(item.id);
  const loaded = loadedId === item.id;
  if (current && loadedId && !built) setBuilt(true);

  useEffect(() => {
    if (built || !loadedId) return;
    const timer = window.setTimeout(() => setBuilt(true), buildDelay);
    return () => window.clearTimeout(timer);
  }, [built, loadedId, buildDelay]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const isPlaying = active && loaded && playing && !paused;
  useEffect(() => {
    if (active) onPlayback(isPlaying);
  }, [active, isPlaying, onPlayback]);

  // On screen and playing, or, before the viewer has started, on screen with its player ready.
  const settled = current && loaded && (active ? isPlaying : playerReady);
  useEffect(() => {
    if (settled) onSettled(position);
  }, [settled, position, onSettled]);

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

  // The video on screen was asked to play and is not moving: it has not started yet, or it stalled.
  const loading = active && !paused && !selection && (!playing || buffering);

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
    // Placed by its position rather than by its order in the page, so the feed can move a slide that
    // has been left behind to the far end of the list without rebuilding it or its player.
    <section
      data-slide
      data-index={position}
      className="absolute inset-x-0 flex h-full snap-start snap-always items-start justify-center pt-[var(--top)]"
      style={{ top: `${position * 100}%` }}
    >
      {/*
        Video on the left, then the action column and, on wide screens, the transcript a little further
        along, all centred as one group.
        The right padding keeps the transcript clear of the feed's up/down buttons on narrower screens.
      */}
      <div className="mx-auto flex w-full max-w-[61rem] items-end justify-center gap-4 md:px-4 lg:pr-[max(1rem,calc(88px_-_(100vw_-_61rem)/2))]">
        <div
          className="relative overflow-hidden md:overflow-visible"
          style={{ width: "var(--card-w)", height: "var(--card-h)" }}
        >
          {/* Ambient glow, like YouTube: the video's own colors, blurred, spilling out behind it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 aspect-[9/16] w-full scale-105 object-cover opacity-25 blur-3xl"
          />
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
              {built && loadedId && (
                <ShortPlayer
                  videoId={loadedId}
                  controls={controls}
                  active={active && loaded}
                  paused={paused}
                  muted={muted}
                  onReady={() => setPlayerReady(true)}
                  onBuffering={setBuffering}
                  onPlaying={() => setPlaying(true)}
                  onPausedChange={setPaused}
                  onTime={handleTime}
                />
              )}
              {/* The cover stays over the player until this video is really moving. */}
              <Cover
                key={item.id}
                id={item.id}
                className={cn(
                  "pointer-events-none transition-opacity duration-300",
                  playing && loaded ? "opacity-0" : "opacity-100",
                )}
              />
            </div>

            {/*
              Phones: YouTube draws the channel, title, like and share along the bottom of the video.
              A light blur covers them, under our own cards.
            */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[calc(env(safe-area-inset-bottom)+48px)] backdrop-blur-md backdrop-saturate-150 md:hidden"
            />

            <button
              type="button"
              aria-label={soundLocked ? "Turn the sound on" : paused ? "Play video" : "Pause video"}
              onClick={() => (soundLocked ? setPaused(false) : setPaused((p) => !p))}
              className="absolute inset-0 z-10"
            />
            {soundLocked && active && (
              // Phones: below the header and its row of topics, which lie over the top of the video.
              <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+120px)] z-20 flex justify-center md:top-4">
                <span className="animate-rise glass inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold">
                  <VolumeX size={16} />
                  Tap for sound
                </span>
              </div>
            )}
            {/* Shown only when the wait is long enough to notice, so a video that starts at once never flashes it. */}
            {loading && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                <span className="animate-late glass grid size-[72px] place-items-center rounded-full">
                  <Loader2 size={30} className="animate-spin" />
                </span>
              </div>
            )}
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
                <Avatar key={item.avatar} src={item.avatar} name={item.channelTitle} />
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
          key={item.id}
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

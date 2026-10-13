"use client";

import { Heart, Play, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useVideoContent } from "@/lib/content";
import { useMediaQuery, WIDE_QUERY } from "@/lib/media";
import type { FeedItem, Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { Actions } from "./Actions";
import { Cover } from "./Cover";
import { LevelBadge } from "./LevelBadge";
import { OVERLAY_CARD, OVERLAY_PRIMARY_TEXT } from "./overlay";
import { PlayerBar, type ScrubberHandle } from "./Scrubber";
import { ShortPlayer, type PlayerControls } from "./ShortPlayer";
import { SpeedSheet } from "./SpeedSheet";
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
  /** Playback speed the viewer chose, 1 being normal. */
  speed: number;
  translation: boolean;
  liked: boolean;
  onLike: (item: FeedItem) => void;
  onTranslation: () => void;
  onMute: () => void;
  onSpeed: (speed: number) => void;
  onShare: (item: FeedItem) => void;
  /** The browser would not play the video with sound: the feed goes silent until the next tap. */
  onSoundBlocked: () => void;
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
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // A grey disc until the picture arrives, then the picture fades in.
    <span className={cn("relative size-8 shrink-0 overflow-hidden rounded-full", !loaded && "skeleton")}>
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

export const ShortSlide = memo(function ShortSlide({
  item,
  position,
  active,
  hold,
  current,
  buildDelay,
  muted,
  soundLocked,
  speed,
  translation,
  liked,
  onLike,
  onTranslation,
  onMute,
  onSpeed,
  onShare,
  onSoundBlocked,
  onSettled,
}: Props) {
  const content = useVideoContent(item.id);
  const contentRef = useRef(content);
  const resumeRef = useRef(false);
  const controls = useRef<PlayerControls | null>(null);
  const progressBar = useRef<HTMLDivElement>(null);
  const scrubber = useRef<ScrubberHandle | null>(null);
  /** Wide screens show the transcript beside the video instead of subtitles on it. */
  const wide = useMediaQuery(WIDE_QUERY);

  const [shownId, setShownId] = useState(item.id);
  /** The video the player has been given. It trails `item` while the slide is asked to hold. */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  /** The player exists. Building one is heavy work for the browser, which the video that is playing would feel. */
  const [built, setBuilt] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(-1);
  const [selection, setSelection] = useState<Selection | null>(null);
  /** A big heart is on its way up over the video, because it has just been liked. */
  const [hearted, setHearted] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  /** The transcript line being played again on its own, or -1, and the second at which it ends. */
  const [replaying, setReplaying] = useState(-1);
  const stopAt = useRef<number | null>(null);

  // Handed another video: everything that belonged to the previous one is dropped. The player stays.
  if (shownId !== item.id) {
    setShownId(item.id);
    setPlaying(false);
    setPaused(false);
    setSegmentIndex(-1);
    setSelection(null);
    setHearted(false);
    setSpeedOpen(false);
    setReplaying(-1);
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

  useEffect(() => {
    stopAt.current = null;
  }, [item.id]);

  const isPlaying = active && loaded && playing && !paused;

  // On screen and playing, or, before the viewer has started, on screen with its player ready.
  const settled = current && loaded && (active ? isPlaying : playerReady);
  useEffect(() => {
    if (settled) onSettled(position);
  }, [settled, position, onSettled]);

  const handleTime = useCallback((time: number, duration: number) => {
    // Written straight to the bar: the time changes several times a second, and nothing else needs to be redrawn for it.
    if (progressBar.current) progressBar.current.style.width = `${Math.min(time / duration, 1) * 100}%`;
    scrubber.current?.update(time, duration);
    const segments = contentRef.current?.segments;
    setSegmentIndex(segments ? findSegment(segments, time) : -1);
    // A line that was played again on its own has been heard to its end.
    if (stopAt.current !== null && time >= stopAt.current) {
      stopAt.current = null;
      setReplaying(-1);
      setPaused(true);
    }
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

  /** Plays one line of the transcript again and stops at its end. */
  const replay = (index: number) => {
    const line = content?.segments[index];
    if (!line) return;
    stopAt.current = line.end;
    setReplaying(index);
    controls.current?.seek(line.start);
    if (!selection) setPaused(false);
  };

  const seek = (seconds: number) => {
    stopAt.current = null;
    setReplaying(-1);
    controls.current?.seek(seconds);
    if (!selection) setPaused(false);
  };

  /**
   * A tap on the video does what the picture shows: a video that is not moving starts, whatever was
   * last asked of it, and only one that is moving is paused. Asking the player itself, rather than
   * trusting the last request, is what stops a tap from being swallowed by a pause nobody saw.
   */
  const togglePlayback = () => {
    if (soundLocked || !controls.current?.isRunning()) {
      setPaused(false);
      controls.current?.play();
    } else {
      setPaused(true);
    }
  };

  const segment = content && segmentIndex >= 0 ? content.segments[segmentIndex] : null;
  const selectedSegment = content && selection ? content.segments[selection.segment] : null;

  const sheet = selection && selectedSegment && (
    <WordSheet
      segment={selectedSegment}
      selection={selection}
      videoId={item.id}
      onSelect={setSelection}
      onClose={closeSheet}
    />
  );

  const actions = {
    liked,
    translation,
    muted,
    speed,
    onSpeed: () => setSpeedOpen((open) => !open),
    onLike: () => {
      if (!liked) setHearted(true);
      onLike(item);
    },
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
        {/* Phones: the card with the player bar under it. */}
        <div className="flex flex-col">
          <div
            className="relative isolate overflow-hidden rounded-[20px] md:overflow-visible md:rounded-none"
            style={{ width: "var(--card-w)", height: "var(--card-h)" }}
          >
            {/* Ambient glow, like YouTube: the video's own colors, blurred, spilling out behind it. */}
            {/* Not on phones: there the video fills the card and the glow would be worked out for nothing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 hidden aspect-[9/16] w-full scale-105 object-cover opacity-25 blur-3xl md:block"
            />
            <div className="relative size-full">
              {/* The 9:16 video, filling the whole card on phones and reaching a little past it (--cut-top, --cut-bottom). */}
              <div
                className="absolute overflow-hidden bg-black md:rounded-3xl"
                style={{
                  width: "var(--video-w)",
                  height: "var(--video-h)",
                  left: "calc((var(--card-w) - var(--video-w)) / 2)",
                  top: "calc((var(--card-h) - var(--cut-top) + var(--cut-bottom) - var(--video-h)) / 2)",
                }}
              >
                {built && loadedId && (
                  <ShortPlayer
                    videoId={loadedId}
                    controls={controls}
                    active={active && loaded}
                    paused={paused}
                    muted={muted}
                    speed={speed}
                    onReady={() => setPlayerReady(true)}
                    onPlaying={() => setPlaying(true)}
                    onPausedChange={setPaused}
                    onTime={handleTime}
                    onSoundBlocked={onSoundBlocked}
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

              <button
                type="button"
                aria-label={soundLocked ? "Turn the sound on" : paused ? "Play video" : "Pause video"}
                onClick={togglePlayback}
                className="absolute inset-0 z-10"
              />
              {soundLocked && active && (
                // Below the video's info in the top left corner.
                <div className="pointer-events-none absolute inset-x-0 top-[64px] z-20 flex justify-center md:top-[68px]">
                  <span className="animate-rise glass-card inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold">
                    <VolumeX size={16} />
                    Tap for sound
                  </span>
                </div>
              )}
              {hearted && (
                <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
                  <Heart
                    size={104}
                    onAnimationEnd={() => setHearted(false)}
                    className="like-heart fill-rose-500 text-rose-500"
                  />
                </div>
              )}
              {paused && !selection && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                  <span className="glass-button grid size-[72px] place-items-center rounded-full">
                    <Play size={30} className="ml-1 fill-white" />
                  </span>
                </div>
              )}

              {/* The video's channel and level, in the top left corner, out of the way of the subtitles. */}
              <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex md:inset-x-4 md:top-4">
                <div className={cn(OVERLAY_CARD, "flex min-w-0 items-center gap-2.5 py-1.5 pl-1.5 pr-3")}>
                  <Avatar key={item.avatar} src={item.avatar} name={item.channelTitle} />
                  <span className={cn(OVERLAY_PRIMARY_TEXT, "truncate")}>{item.channelTitle}</span>
                  {item.level && <LevelBadge level={item.level} className="shrink-0" />}
                </div>
              </div>

              {/* Right padding on phones leaves room for the action buttons. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 pb-3 pl-3 pr-[68px] md:px-4 md:pb-4">
                {segment && !wide && (
                  <Subtitles
                    key={segmentIndex}
                    segment={segment}
                    segmentIndex={segmentIndex}
                    showTranslation={translation}
                    selection={selection}
                    onSelect={select}
                  />
                )}
              </div>

              <Actions
                {...actions}
                playback={false}
              className="absolute bottom-3 right-3 z-20 flex-col md:hidden"
              />

              {/* Desktop: a thin bar along the bottom of the video. Phones have the seek bar under the card. */}
              <div className="absolute inset-x-0 bottom-0 z-30 h-[3px] bg-white/25 max-md:hidden">
                <div
                  key={item.id}
                  ref={progressBar}
                  className="h-full w-0 bg-accent transition-[width] duration-150 ease-linear"
                />
              </div>

              {!wide && sheet}
              <SpeedSheet open={speedOpen} speed={speed} onChange={onSpeed} onClose={() => setSpeedOpen(false)} />
            </div>
          </div>
          <PlayerBar
            key={item.id}
            handle={scrubber}
            onSeek={seek}
            muted={muted}
            speed={speed}
            onMute={onMute}
            onSpeed={actions.onSpeed}
            className="md:hidden"
          />
        </div>

        <Actions {...actions} className="hidden flex-col md:flex" />

        {/* Only where it is shown: on a phone it would be hundreds of hidden elements kept up to date for nothing. */}
        {wide && (
          <Transcript
            key={item.id}
            segments={content?.segments ?? null}
            level={content?.level ?? item.level}
            current={segmentIndex}
            showTranslation={translation}
            selection={selection}
            onSelect={select}
            onSeek={seek}
            onReplay={replay}
            replaying={replaying}
          >
            {sheet}
          </Transcript>
        )}
      </div>
    </section>
  );
});

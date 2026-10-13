"use client";

import { ChevronsLeft, ChevronsRight, Heart, Play, RotateCcw, Snail, VolumeX } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useVideoContent } from "@/lib/content";
import { SHORT_QUERY, useMediaQuery, WIDE_QUERY } from "@/lib/media";
import { useSettings } from "@/lib/settings";
import { useTapGestures, type Side } from "@/lib/taps";
import type { FeedItem, Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { Actions } from "./Actions";
import { Cover } from "./Cover";
import { SeekLine, type ScrubberHandle } from "./Scrubber";
import { ShortPlayer, type PlayerControls } from "./ShortPlayer";
import { formatSpeed, SpeedSheet, tidySpeed } from "./SpeedSheet";
import { subtitleHeight, Subtitles } from "./Subtitles";
import { Transcript, TranscriptSheet } from "./Transcript";
import { VideoInfo } from "./VideoInfo";
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
  /** The video stops at the end of every line, until the viewer plays on. */
  linePause: boolean;
  liked: boolean;
  onLike: (item: FeedItem) => void;
  onTranslation: () => void;
  onMute: () => void;
  onSpeed: (speed: number) => void;
  onLinePause: () => void;
  onShare: (item: FeedItem) => void;
  /** The browser would not play the video with sound: the feed goes silent until the next tap. */
  onSoundBlocked: () => void;
  /** Told once the video of the slide on screen is under way: the cue to load the other videos. */
  onSettled: (position: number) => void;
  /** Told, while this is the slide on screen, whether its video is stopped with the play button showing. */
  onStopped: (stopped: boolean) => void;
}

/** A line comes up on screen this much before it is spoken. */
const LINE_LEAD = 0.15;
/** A line counts as heard this much before its end: the clock is read only every 150ms. */
const HEARD_EARLY = 0.1;
/** A jump to a line lands this much before it, so its first word is not cut. */
const LINE_LEAD_IN = 0.1;
/** Back on a line that has played longer than this starts it again, sooner goes to the line before. */
const RESTART_S = 1;
/**
 * After a jump, readings of the clock further than this from where it went are from before it, and
 * are ignored for JUMP_MS at most: the player takes a moment to move.
 */
const JUMP_SETTLE_S = 1;
const JUMP_MS = 1000;
/** How long the answer to a double tap stays on screen. */
const STEP_MS = 700;
/** Held down, the video plays at this speed, or a step under the viewer's own when that is slow already. */
const HOLD_SPEED = 0.75;

const heldSpeed = (speed: number) => (speed > HOLD_SPEED ? HOLD_SPEED : tidySpeed(speed - 0.25));

/** The line on screen at this time: the last one that has started, or -1. */
function lineAt(segments: Segment[], time: number): number {
  let found = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start <= time + LINE_LEAD) found = i;
    else break;
  }
  return found;
}

function findSegment(segments: Segment[], time: number): number {
  const found = lineAt(segments, time);
  if (found === -1) return -1;
  // Keep the last line on screen a moment after it ends.
  return time <= segments[found].end + 1.2 ? found : -1;
}

/** The last line heard to its end by this time, or -1. */
function heardBy(segments: Segment[], time: number): number {
  let found = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].end - HEARD_EARLY <= time) found = i;
    else break;
  }
  return found;
}

/**
 * The lines counted as heard when the video is put at this time: those that have ended, and every
 * line before the one on screen, since caption times overlap and a line may end inside the next.
 */
const heardAt = (segments: Segment[], time: number) => Math.max(heardBy(segments, time), lineAt(segments, time) - 1);

/**
 * Where the badges at the top of the video go. Phones: below the part of the top bar's row that lies
 * over the video once the video has grown up under it (none of it while the bar has its own room),
 * moving along as that room changes.
 */
const TOP_BADGE = "top-[calc(var(--bar-h)-var(--header-h)+0.75rem)] md:top-4";

type StepKind = "again" | "previous" | "next" | "last";

const STEPS: Record<StepKind, { label: string; Icon: typeof RotateCcw }> = {
  again: { label: "Again", Icon: RotateCcw },
  previous: { label: "Previous line", Icon: ChevronsLeft },
  next: { label: "Next line", Icon: ChevronsRight },
  last: { label: "Last line", Icon: ChevronsRight },
};

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
  linePause,
  liked,
  onLike,
  onTranslation,
  onMute,
  onSpeed,
  onLinePause,
  onShare,
  onSoundBlocked,
  onSettled,
  onStopped,
}: Props) {
  const content = useVideoContent(item.id);
  const contentRef = useRef(content);
  const resumeRef = useRef(false);
  const controls = useRef<PlayerControls | null>(null);
  const scrubber = useRef<ScrubberHandle | null>(null);
  /** Wide screens show the transcript beside the video instead of subtitles on it. */
  const wide = useMediaQuery(WIDE_QUERY);
  const short = useMediaQuery(SHORT_QUERY);
  const { subtitleSize } = useSettings();

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
  /** Phones and narrower screens: the transcript, in a sheet over the bottom of the screen. */
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  /** A finger is held on the video, which plays slower until it lifts. */
  const [slow, setSlow] = useState(false);
  /** The answer to a double tap, shown for a moment on the side that was tapped. */
  const [step, setStep] = useState<{ side: Side; kind: StepKind; key: number } | null>(null);
  const stepTimer = useRef(0);
  /** Where the video was at the last reading of its clock. */
  const timeRef = useRef(0);
  /** The last line heard to its end, so that pausing after each line stops once per line. */
  const heardRef = useRef(-1);
  /** The line kept on screen while the video waits at its end, rather than the next one coming up. */
  const pinnedRef = useRef<number | null>(null);
  /** A jump the player may not have made yet (see JUMP_SETTLE_S). */
  const jumpRef = useRef<{ to: number; until: number } | null>(null);
  const linePauseRef = useRef(linePause);

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
    setTranscriptOpen(false);
    setSlow(false);
    setStep(null);
  }
  // The sheet belongs to the video on screen, and wide screens have the transcript beside the video.
  if (transcriptOpen && (!current || wide)) setTranscriptOpen(false);
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
    // Subtitles that arrive once the video is under way: what has been played so far is not paused for.
    heardRef.current = content ? heardAt(content.segments, timeRef.current) : -1;
  }, [content]);

  useEffect(() => {
    stopAt.current = null;
    timeRef.current = 0;
    pinnedRef.current = null;
    jumpRef.current = null;
  }, [item.id]);

  useEffect(() => {
    linePauseRef.current = linePause;
  }, [linePause]);

  // Played on: the line kept on screen gives way to the next one.
  useEffect(() => {
    if (!paused) pinnedRef.current = null;
  }, [paused]);

  useEffect(() => () => window.clearTimeout(stepTimer.current), []);

  const isPlaying = active && loaded && playing && !paused;

  // On screen and playing, or, before the viewer has started, on screen with its player ready.
  const settled = current && loaded && (active ? isPlaying : playerReady);
  useEffect(() => {
    if (settled) onSettled(position);
  }, [settled, position, onSettled]);

  const stopped = paused && !selection;
  useEffect(() => {
    if (current) onStopped(stopped);
  }, [current, stopped, onStopped]);

  const handleTime = useCallback((time: number, duration: number) => {
    const jump = jumpRef.current;
    if (jump) {
      if (performance.now() < jump.until && Math.abs(time - jump.to) > JUMP_SETTLE_S) return;
      jumpRef.current = null;
    }
    timeRef.current = time;
    // Written straight to the timeline: the time changes several times a second, and nothing else needs to be redrawn for it.
    scrubber.current?.update(time, duration);
    const segments = contentRef.current?.segments;
    if (segments) {
      const heard = heardBy(segments, time);
      if (heard < heardRef.current) {
        // Back at an earlier moment without a jump from here: the video went round again.
        heardRef.current = heard;
      } else if (heard > heardRef.current) {
        heardRef.current = heard;
        // Pausing after each line: the video waits at the end of the line just heard, and keeps it on screen.
        if (linePauseRef.current && pinnedRef.current === null) {
          pinnedRef.current = heard;
          setPaused(true);
        }
      }
    }
    setSegmentIndex(pinnedRef.current ?? (segments ? findSegment(segments, time) : -1));
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

  /** Puts the video at a moment. What comes before it counts as heard, so pausing after each line does not stop at once. */
  const jumpTo = (seconds: number) => {
    timeRef.current = seconds;
    heardRef.current = content ? heardAt(content.segments, seconds) : -1;
    pinnedRef.current = null;
    jumpRef.current = { to: seconds, until: performance.now() + JUMP_MS };
    controls.current?.seek(seconds);
  };

  /** Plays one line of the transcript again and stops at its end. */
  const replay = (index: number) => {
    const line = content?.segments[index];
    if (!line) return;
    stopAt.current = line.end;
    setReplaying(index);
    jumpTo(line.start);
    if (!selection) setPaused(false);
  };

  const seek = (seconds: number) => {
    stopAt.current = null;
    setReplaying(-1);
    jumpTo(seconds);
    if (!selection) setPaused(false);
  };

  const showStep = (side: Side, kind: StepKind) => {
    window.clearTimeout(stepTimer.current);
    setStep((prev) => ({ side, kind, key: (prev?.key ?? 0) + 1 }));
    stepTimer.current = window.setTimeout(() => setStep(null), STEP_MS);
  };

  /**
   * A double tap. On the right: the next line. On the left: the line on screen from its start, or the
   * line before when this one has only just begun, so a second double tap goes one line further back.
   */
  const stepLine = (side: Side) => {
    const segments = content?.segments;
    if (!segments?.length) return;
    const time = timeRef.current;
    const shown = pinnedRef.current ?? lineAt(segments, time);
    let target: number;
    if (side > 0) {
      target = shown + 1;
      if (target >= segments.length) {
        showStep(side, "last");
        return;
      }
    } else {
      const restart = shown >= 0 && time - segments[shown].start > RESTART_S;
      target = restart ? shown : Math.max(0, shown - 1);
    }
    stopAt.current = null;
    setReplaying(-1);
    jumpTo(Math.max(0, segments[target].start - LINE_LEAD_IN));
    setSegmentIndex(target);
    if (!selection) setPaused(false);
    showStep(side, side > 0 ? "next" : target === shown ? "again" : "previous");
  };

  /** A long press slows the video down while the finger is held, if it is playing. */
  const holdSlow = (holding: boolean) => {
    if (holding && !(current && isPlaying)) return false;
    setSlow(holding);
    return true;
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

  // Phones and narrower screens: a tap plays or pauses, a double tap goes from line to line, a long press slows down.
  // Not before the first tap, which is for the sound and acts at once.
  const taps = useTapGestures({
    enabled: !wide && !soundLocked,
    // A tap that waited to be sure it was not a double tap may come after the video was swiped away.
    onTap: () => current && togglePlayback(),
    onDoubleTap: stepLine,
    onHold: holdSlow,
  });

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
    transcriptOpen,
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
        {/*
          One card: the video, and the channel row joined under it, as wide as the video (a long title
          is cut, it does not widen the row). Rounded at the top of the video and the bottom of the row.
        */}
        <div className="flex w-[var(--card-w)] shrink-0 flex-col">
          <div
            className="relative isolate overflow-hidden rounded-t-xl md:overflow-visible md:rounded-none"
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
                className="absolute overflow-hidden bg-black md:rounded-t-2xl"
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
                    speed={slow ? heldSpeed(speed) : speed}
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

              {/* touch-manipulation: a double tap is ours, the browser must not zoom in on it. */}
              <button
                type="button"
                aria-label={soundLocked ? "Turn the sound on" : paused ? "Play video" : "Pause video"}
                {...taps}
                className="absolute inset-0 z-10 touch-manipulation [-webkit-touch-callout:none]"
              />
              {slow && (
                <div className={cn(TOP_BADGE, "pointer-events-none absolute inset-x-0 z-20 flex justify-center")}>
                  <span className="animate-rise glass-card inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold">
                    <Snail size={16} />
                    {formatSpeed(heldSpeed(speed))}
                  </span>
                </div>
              )}
              {step && (
                // In the middle of the half that was tapped. The right one is a little in from the
                // middle of its half, clear of the action buttons.
                <div
                  key={step.key}
                  className={cn(
                    "pointer-events-none absolute top-[38%] z-20 -translate-x-1/2 -translate-y-1/2",
                    step.side < 0 ? "left-1/4" : "left-[70%]",
                  )}
                >
                  <StepBadge kind={step.kind} />
                </div>
              )}
              {soundLocked && active && (
                <div className={cn(TOP_BADGE, "pointer-events-none absolute inset-x-0 z-20 flex justify-center")}>
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
              {stopped && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                  <span className="glass-button grid size-[72px] place-items-center rounded-full">
                    <Play size={30} className="ml-1 fill-white" />
                  </span>
                </div>
              )}

              {/*
                Phones: the action buttons, and under them the subtitles across the whole width. Room
                for a few rows of subtitles is kept below the buttons, so they stay where they are as
                the lines come and go; only a line longer than that pushes them up. The space at the
                bottom is the timeline's strip.
              */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-3 pb-5 md:px-4 md:pb-7">
                <Actions
                  {...actions}
                  onTranscript={() => setTranscriptOpen(true)}
                  playback={false}
                  className="flex-col self-end *:pointer-events-auto md:hidden"
                />
                {!wide && (
                  <div
                    className="flex flex-col justify-end"
                    style={{ minHeight: subtitleHeight(subtitleSize, short ? 2 : 3, translation ? (short ? 1 : 2) : 0) }}
                  >
                    {segment && (
                      <Subtitles
                        key={segmentIndex}
                        segment={segment}
                        segmentIndex={segmentIndex}
                        showTranslation={translation}
                        size={subtitleSize}
                        selection={selection}
                        onSelect={select}
                      />
                    )}
                  </div>
                )}
              </div>

              <SeekLine key={item.id} handle={scrubber} onSeek={seek} />

              {/* With the transcript open, the word sheet opens inside it instead. */}
              {!wide && !transcriptOpen && sheet}
              <SpeedSheet open={speedOpen} speed={speed} onChange={onSpeed} onClose={() => setSpeedOpen(false)} />
            </div>
          </div>
          <VideoInfo item={item} muted={muted} speed={speed} onMute={onMute} onSpeed={actions.onSpeed} />
        </div>

        <Actions
          {...actions}
          onTranscript={wide ? undefined : () => setTranscriptOpen(true)}
          className="hidden flex-col md:flex"
        />

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
            linePause={linePause}
            onLinePause={onLinePause}
          >
            {sheet}
          </Transcript>
        )}
      </div>

      {transcriptOpen && (
        <TranscriptSheet
          segments={content?.segments ?? null}
          level={content?.level ?? item.level}
          current={segmentIndex}
          showTranslation={translation}
          selection={selection}
          onSelect={select}
          onSeek={seek}
          onReplay={replay}
          replaying={replaying}
          linePause={linePause}
          onLinePause={onLinePause}
          onClose={() => setTranscriptOpen(false)}
        >
          {sheet}
        </TranscriptSheet>
      )}
    </section>
  );
});

/** The answer to a double tap: where it went, in a word or two. */
function StepBadge({ kind }: { kind: StepKind }) {
  const { label, Icon } = STEPS[kind];
  return (
    <span className="line-step glass-card flex flex-col items-center gap-1 whitespace-nowrap rounded-2xl px-4 py-2.5 text-[13px] font-semibold">
      <Icon size={22} />
      {label}
    </span>
  );
}

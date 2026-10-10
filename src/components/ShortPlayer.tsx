"use client";

import { useEffect, useRef, type RefObject } from "react";
import { loadYouTubeApi } from "@/lib/youtube-iframe";

/** What the slide may do with the player from outside, set once the player is ready. */
export interface PlayerControls {
  seek: (seconds: number) => void;
}

interface Props {
  /** The video to show. When it changes the same player is handed the new video, it is not rebuilt. */
  videoId: string;
  controls?: RefObject<PlayerControls | null>;
  active: boolean;
  paused: boolean;
  muted: boolean;
  onReady: () => void;
  /** Told when the video stops to load more, and when it moves again. */
  onBuffering: (buffering: boolean) => void;
  onPlaying: () => void;
  onPausedChange: (paused: boolean) => void;
  onTime: (seconds: number, duration: number) => void;
}

/**
 * YouTube shows its own captions when the viewer's YouTube settings ask for them, and
 * `cc_load_policy: 0` does not always stop that. Our tappable subtitles replace them, so the
 * captions module is unloaded. This call works but is not in the documented API, hence the guard.
 */
function hideYouTubeCaptions(player: YT.Player) {
  (player as YT.Player & { unloadModule?: (name: string) => void }).unloadModule?.("captions");
}

const WARM_RETRY_MS = 1000;

/** A player that is warming up stays silent whatever the viewer's sound setting is. */
function syncMute(player: YT.Player, muted: boolean, warming: boolean) {
  if (muted || warming) player.mute();
  else player.unMute();
}

/** Sets a player going: on the video it already holds, or on `next` when it is handed another one. */
function start(player: YT.Player, play: boolean, next: string | null) {
  if (next && play) player.loadVideoById(next);
  else if (next) player.cueVideoById(next);
  else if (play) player.playVideo();
}

/**
 * One YouTube player. Building one is the expensive part (a whole page of YouTube's own code), so
 * a slide keeps its player for good and only swaps the video in it, the way the Shorts app does.
 */
export function ShortPlayer({
  videoId,
  controls,
  active,
  paused,
  muted,
  onReady,
  onBuffering,
  onPlaying,
  onPausedChange,
  onTime,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const readyRef = useRef(false);
  /** The video the player was last given. */
  const heldRef = useRef(videoId);
  /**
   * A player that is not on screen plays silently until its first frame, then waits paused at the
   * start. That makes YouTube buffer the clip, so it starts at once when it is swiped to.
   */
  const warmingRef = useRef(false);
  const live = useRef({ videoId, active, paused, muted, onReady, onBuffering, onPlaying, onPausedChange, onTime });

  useEffect(() => {
    live.current = { videoId, active, paused, muted, onReady, onBuffering, onPlaying, onPausedChange, onTime };
  });

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi().then((api) => {
      const host = hostRef.current;
      if (cancelled || !host) return;

      const target = document.createElement("div");
      host.appendChild(target);
      heldRef.current = live.current.videoId;

      playerRef.current = new api.Player(target, {
        videoId: heldRef.current,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          cc_load_policy: 0,
          hl: "en",
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            readyRef.current = true;
            live.current.onReady();
            if (controls) controls.current = { seek: (seconds) => e.target.seekTo(seconds, true) };
            // The slide may have been handed another video while the player was still being built.
            const changed = live.current.videoId !== heldRef.current;
            heldRef.current = live.current.videoId;
            warmingRef.current = !live.current.active;
            syncMute(e.target, live.current.muted, warmingRef.current);
            start(e.target, warmingRef.current || !live.current.paused, changed ? heldRef.current : null);
          },
          onStateChange: (e) => {
            if (e.data === api.PlayerState.PLAYING && warmingRef.current) {
              warmingRef.current = false;
              e.target.pauseVideo();
              e.target.seekTo(0, true);
              syncMute(e.target, live.current.muted, false);
              return;
            }
            if (!warmingRef.current) live.current.onBuffering(e.data === api.PlayerState.BUFFERING);
            if (e.data === api.PlayerState.PLAYING) {
              // The module loads with playback, so it is unloaded here rather than on ready.
              hideYouTubeCaptions(e.target);
              live.current.onPlaying();
              live.current.onPausedChange(false);
            } else if (e.data === api.PlayerState.PAUSED && live.current.active && !document.hidden) {
              // Paused while the page is on screen: by the viewer, through YouTube or the system's own controls.
              // A browser may also pause a silent video in a tab that is put away, and that is not the viewer's doing.
              live.current.onPausedChange(true);
            }
            // Shorts loop until the viewer swipes away.
            if (e.data === api.PlayerState.ENDED) {
              e.target.seekTo(0, true);
              e.target.playVideo();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      warmingRef.current = false;
      if (controls) controls.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [controls]);

  // Handed another video: the player stays, only the clip is loaded, and it warms up like a new one.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current || heldRef.current === videoId) return;
    heldRef.current = videoId;
    warmingRef.current = !live.current.active;
    syncMute(player, live.current.muted, warmingRef.current);
    start(player, warmingRef.current || !live.current.paused, videoId);
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    if (active && !paused) {
      // Swiped to before the warm-up finished: it simply carries on as the real playback.
      warmingRef.current = false;
      syncMute(player, live.current.muted, false);
      player.playVideo();
    } else if (!warmingRef.current) {
      player.pauseVideo();
    }
  }, [active, paused]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    syncMute(player, muted, warmingRef.current);
  }, [muted]);

  // Back from another tab: whatever the browser did to the video meanwhile, it should be playing again.
  useEffect(() => {
    if (!active || paused) return;
    const resume = () => {
      if (!document.hidden && readyRef.current) playerRef.current?.playVideo();
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [active, paused]);

  // Browsers refuse to start a video before the first tap on the page, even a silent one,
  // so a warm-up that did not get going is asked again until it does.
  useEffect(() => {
    if (active) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current || !warmingRef.current) return;
      const state = player.getPlayerState();
      if (state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) player.playVideo();
    }, WARM_RETRY_MS);
    return () => window.clearInterval(timer);
  }, [active, videoId]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      const duration = player.getDuration();
      if (duration > 0) live.current.onTime(player.getCurrentTime(), duration);
    }, 150);
    return () => window.clearInterval(timer);
  }, [active]);

  return <div ref={hostRef} className="absolute inset-0 [&_iframe]:size-full" />;
}

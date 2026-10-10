"use client";

import { useEffect, useRef, type RefObject } from "react";
import { loadYouTubeApi } from "@/lib/youtube-iframe";

/** What the slide may do with the player from outside, set once the player is ready. */
export interface PlayerControls {
  seek: (seconds: number) => void;
}

interface Props {
  videoId: string;
  controls?: RefObject<PlayerControls | null>;
  active: boolean;
  paused: boolean;
  muted: boolean;
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

/** A player that is warming up stays silent whatever the viewer's sound setting is. */
function syncMute(player: YT.Player, muted: boolean, warming: boolean) {
  if (muted || warming) player.mute();
  else player.unMute();
}

export function ShortPlayer({ videoId, controls, active, paused, muted, onPlaying, onPausedChange, onTime }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const readyRef = useRef(false);
  /**
   * A player mounted ahead of the viewer plays silently until its first frame, then waits paused at
   * the start. That makes YouTube buffer the clip, so it starts at once when it is swiped to.
   */
  const warmingRef = useRef(false);
  const live = useRef({ active, paused, muted, onPlaying, onPausedChange, onTime });

  useEffect(() => {
    live.current = { active, paused, muted, onPlaying, onPausedChange, onTime };
  });

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi().then((api) => {
      const host = hostRef.current;
      if (cancelled || !host) return;

      const target = document.createElement("div");
      host.appendChild(target);

      playerRef.current = new api.Player(target, {
        videoId,
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
            if (controls) controls.current = { seek: (seconds) => e.target.seekTo(seconds, true) };
            warmingRef.current = !live.current.active;
            syncMute(e.target, live.current.muted, warmingRef.current);
            if (warmingRef.current || !live.current.paused) e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === api.PlayerState.PLAYING && warmingRef.current) {
              warmingRef.current = false;
              e.target.pauseVideo();
              e.target.seekTo(0, true);
              syncMute(e.target, live.current.muted, false);
              return;
            }
            if (e.data === api.PlayerState.PLAYING) {
              // The module loads with playback, so it is unloaded here rather than on ready.
              hideYouTubeCaptions(e.target);
              live.current.onPlaying();
              live.current.onPausedChange(false);
            } else if (e.data === api.PlayerState.PAUSED && live.current.active) {
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
  }, [videoId, controls]);

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

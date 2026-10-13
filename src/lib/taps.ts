"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** A second tap within this long makes a double tap, so a single tap waits this long before it acts. */
const DOUBLE_TAP_MS = 280;
/** A finger kept down this long is a long press. */
const HOLD_MS = 400;
/** A finger that moves further than this is scrolling, not pressing. */
const MOVE_PX = 10;

/** The half of the video a double tap landed on: -1 the left, 1 the right. */
export type Side = -1 | 1;

interface Options {
  /** Double taps and long presses are recognised. When false, a tap acts at once and that is all. */
  enabled: boolean;
  onTap: () => void;
  onDoubleTap: (side: Side) => void;
  /** A long press has started: returns whether it is taken. Called again with false when the finger lifts. */
  onHold: (holding: boolean) => boolean | void;
}

/**
 * Taps on the video, the way phone players read them: a tap, a double tap on one side, a long press.
 * Taps that follow a double tap quickly keep counting as double taps, so three taps go two steps.
 * Enter and Space on the element are a plain tap.
 */
export function useTapGestures(options: Options) {
  const live = useRef(options);
  useEffect(() => {
    live.current = options;
  });

  const state = useRef({
    tapTimer: 0,
    holdTimer: 0,
    /** Where the finger went down, until it moves too far to be a long press. */
    start: null as { x: number; y: number } | null,
    holding: false,
    /** The click that comes with lifting the finger after a long press is not a tap. */
    swallow: false,
    streakUntil: 0,
  });

  useEffect(() => {
    const s = state.current;
    return () => {
      window.clearTimeout(s.tapTimer);
      window.clearTimeout(s.holdTimer);
    };
  }, []);

  const release = () => {
    const s = state.current;
    s.start = null;
    window.clearTimeout(s.holdTimer);
    if (!s.holding) return;
    s.holding = false;
    s.swallow = true;
    live.current.onHold(false);
  };

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      const s = state.current;
      // A long press on some phones is not followed by a click, so a swallow left over is dropped here.
      s.swallow = false;
      if (!live.current.enabled || e.button !== 0) return;
      s.start = { x: e.clientX, y: e.clientY };
      window.clearTimeout(s.holdTimer);
      s.holdTimer = window.setTimeout(() => {
        s.holding = live.current.onHold(true) === true;
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = state.current;
      if (!s.start || s.holding) return;
      if (Math.hypot(e.clientX - s.start.x, e.clientY - s.start.y) > MOVE_PX) {
        window.clearTimeout(s.holdTimer);
        s.start = null;
      }
    },
    onPointerUp: release,
    // The browser took the finger over to scroll the feed.
    onPointerCancel: release,
    // A long press would otherwise bring up the browser's own menu.
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if (live.current.enabled) e.preventDefault();
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      const s = state.current;
      if (s.swallow) {
        s.swallow = false;
        return;
      }
      const { enabled, onTap, onDoubleTap } = live.current;
      if (!enabled || e.detail === 0) {
        onTap();
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const side: Side = e.clientX < rect.left + rect.width / 2 ? -1 : 1;
      const now = performance.now();
      if (s.tapTimer || now < s.streakUntil) {
        window.clearTimeout(s.tapTimer);
        s.tapTimer = 0;
        s.streakUntil = now + DOUBLE_TAP_MS;
        onDoubleTap(side);
        return;
      }
      s.tapTimer = window.setTimeout(() => {
        s.tapTimer = 0;
        live.current.onTap();
      }, DOUBLE_TAP_MS);
    },
  };
}

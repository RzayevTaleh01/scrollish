"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from "react";

/** A drag counts once the finger has moved this far, so taps on the buttons still work. */
const DRAG_START_PX = 8;
/** Released past this share of the sheet's height, or flicked faster than this, the sheet closes. */
const CLOSE_SHARE = 0.3;
const CLOSE_SPEED = 0.6; // px per ms
const SLIDE_MS = 220;

/** Lets the sheet be pulled down with a finger or the mouse and closes it when pulled far or fast enough. */
export function useSwipeDown(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; y: number; time: number; moving: boolean } | null>(null);
  const dragged = useRef(false);
  const [offset, setOffset] = useState(0);
  const [moving, setMoving] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = () => {
    setClosing(true);
    setOffset(sheetRef.current?.offsetHeight ?? 400);
    window.setTimeout(onClose, SLIDE_MS);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragged.current = false;
    drag.current = { pointer: e.pointerId, y: e.clientY, time: performance.now(), moving: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dy = e.clientY - d.y;
    if (!d.moving) {
      if (dy < -DRAG_START_PX) drag.current = null;
      if (dy <= DRAG_START_PX) return;
      d.moving = true;
      dragged.current = true;
      setMoving(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setOffset(Math.max(0, dy - DRAG_START_PX));
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moving || d.pointer !== e.pointerId) return;
    setMoving(false);
    const dy = e.clientY - d.y;
    const speed = dy / Math.max(1, performance.now() - d.time);
    const height = sheetRef.current?.offsetHeight ?? 400;
    if (dy > height * CLOSE_SHARE || (speed > CLOSE_SPEED && dy > 30)) close();
    else setOffset(0);
  };

  // A drag that ends on a button must not also press it.
  const onClickCapture = (e: MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  /** For the element that moves. */
  const sheet = {
    ref: sheetRef,
    style: {
      transform: `translateY(${offset}px)`,
      transition: moving ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
    },
  };
  /** For the part that can be pulled: the whole sheet, or only its top when the rest scrolls. */
  const handle = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onClickCapture,
  };

  return { close, closing, sheet, handle, props: { ...sheet, ...handle } };
}

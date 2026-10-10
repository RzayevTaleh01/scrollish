"use client";

import { Bookmark, Volume2, X } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { languageOf } from "@/lib/languages";
import { savedKey, useSaved } from "@/lib/saved";
import { useSettings } from "@/lib/settings";
import { speak } from "@/lib/speak";
import type { Segment } from "@/lib/types";
import { resolveSelection, sentenceOf, type Selection } from "@/lib/units";
import { LevelBadge } from "./LevelBadge";

interface Props {
  segment: Segment;
  selection: Selection;
  videoId: string;
  onSelect: (selection: Selection) => void;
  onClose: () => void;
}

/** A drag counts once the finger has moved this far, so taps on the buttons still work. */
const DRAG_START_PX = 8;
/** Released past this share of the sheet's height, or flicked faster than this, the sheet closes. */
const CLOSE_SHARE = 0.3;
const CLOSE_SPEED = 0.6; // px per ms
const SLIDE_MS = 220;

/** Lets the sheet be pulled down with a finger or the mouse and closes it when pulled far or fast enough. */
function useSwipeDown(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; y: number; time: number; moving: boolean } | null>(null);
  const dragged = useRef(false);
  const [offset, setOffset] = useState(0);
  const [moving, setMoving] = useState(false);

  const close = () => {
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
  const onClickCapture = (e: React.MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return {
    close,
    props: {
      ref: sheetRef,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
      style: {
        transform: `translateY(${offset}px)`,
        transition: moving ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      },
    },
  };
}

export function WordSheet({ segment, selection, videoId, onSelect, onClose }: Props) {
  const { has, toggle } = useSaved();
  const { language } = useSettings();
  const resolved = resolveSelection(segment, selection);
  const key = savedKey(language, resolved.kind, resolved.term);
  const saved = has(key);
  const example = sentenceOf(segment);
  const swipe = useSwipeDown(onClose);

  const selectWord = (index: number) =>
    onSelect({ segment: selection.segment, from: index, to: index, kind: "word" });

  const onSave = () =>
    toggle({
      key,
      lang: language,
      term: resolved.term,
      kind: resolved.kind,
      surface: resolved.surface,
      pos: resolved.pos,
      level: resolved.level ?? "B1",
      az: resolved.az,
      en: resolved.en,
      example,
      exampleTr: segment.tr,
      videoId,
    });

  return (
    // The outer layer follows the finger; the inner one keeps the rise-in animation, which would
    // otherwise override the drag transform. touch-action stops the swipe from scrolling the feed.
    <div {...swipe.props} className="absolute inset-x-0 bottom-0 z-40 touch-none select-none">
      <div className="glass-strong animate-rise rounded-t-3xl px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2.5 text-left">
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 cursor-grab rounded-full bg-white/30" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{resolved.kind === "phrase" ? "Phrase" : "Word"}</Tag>
              {resolved.pos && <Tag>{resolved.pos}</Tag>}
              {resolved.level && <LevelBadge level={resolved.level} />}
            </div>
            <h3 className="mt-2.5 break-words text-[26px] font-bold leading-tight">{resolved.surface}</h3>
            {resolved.term !== resolved.surface.toLowerCase() && (
              <p className="mt-0.5 text-sm text-muted">{resolved.term}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <SheetButton label="Pronounce" onClick={() => speak(resolved.surface, languageOf(language).speech)}>
              <Volume2 size={19} />
            </SheetButton>
            <SheetButton label={saved ? "Remove from saved" : "Save"} active={saved} onClick={onSave}>
              <Bookmark size={19} className={saved ? "fill-current" : ""} />
            </SheetButton>
            <SheetButton label="Close" onClick={swipe.close}>
              <X size={19} />
            </SheetButton>
          </div>
        </div>

        {resolved.az ? (
          <p className="mt-4 text-[22px] font-semibold leading-snug text-translation">{resolved.az}</p>
        ) : (
          <p className="mt-4 text-sm text-muted">No translation was generated for this word.</p>
        )}
        {resolved.en && <p className="mt-1 text-sm text-muted">{resolved.en}</p>}

        {resolved.kind === "phrase" && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pick a single word</p>
            <div className="flex flex-wrap gap-2">
              {resolved.words.map((w) => (
                <button
                  key={w.index}
                  onClick={() => selectWord(w.index)}
                  className="liquid glass-soft rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white/15"
                >
                  {w.surface}
                </button>
              ))}
            </div>
          </div>
        )}

        {resolved.kind === "word" && resolved.parent && (
          <button
            onClick={() =>
              onSelect({
                segment: selection.segment,
                from: resolved.parent!.from,
                to: resolved.parent!.to,
                kind: "phrase",
              })
            }
            className="liquid glass-soft mt-4 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/15"
          >
            <span className="text-muted">Part of: </span>
            <span className="font-semibold">{resolved.parent.lemma}</span>
            <span className="text-translation"> ({resolved.parent.az})</span>
          </button>
        )}

        <div className="glass-soft mt-4 rounded-2xl p-3.5">
          <p className="text-[15px] leading-relaxed">
            {segment.tokens.map((token, i) => (
              <span
                key={i}
                className={cn(i >= selection.from && i <= selection.to && "font-semibold text-accent")}
              >
                {token.t}{" "}
              </span>
            ))}
          </p>
          {segment.tr && <p className="mt-1.5 text-sm leading-snug text-muted">{segment.tr}</p>}
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

function SheetButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "liquid grid size-10 place-items-center rounded-full",
        active ? "bg-accent text-accent-ink" : "glass-soft hover:bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

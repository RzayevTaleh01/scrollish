"use client";

import type { CSSProperties } from "react";
import type { SubtitleSize } from "@/lib/settings";
import type { Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { SegmentText } from "./SegmentText";

/**
 * The subtitle sizes, in px. A word is a button `pad` taller than the text above and below, and the
 * buttons of one row touch those of the next, so there is no gap between rows where a finger misses.
 */
const SIZES: Record<SubtitleSize, { text: number; line: number; pad: number; tr: number; trLine: number }> = {
  small: { text: 15, line: 22, pad: 3, tr: 13, trLine: 18 },
  medium: { text: 17, line: 24, pad: 4, tr: 14, trLine: 20 },
  large: { text: 19, line: 26, pad: 5, tr: 16, trLine: 22 },
};
/** The card's padding above and below (py-2.5), and the divider before the translation with its space. */
const CARD_Y = 20;
const DIVIDER_Y = 13;

/** The height of a subtitle card with this many rows of the line and of its translation. */
export function subtitleHeight(size: SubtitleSize, rows: number, translationRows: number): number {
  const s = SIZES[size];
  return CARD_Y + rows * (s.line + 2 * s.pad) + (translationRows ? DIVIDER_Y + translationRows * s.trLine : 0);
}

interface Props {
  segment: Segment;
  segmentIndex: number;
  showTranslation: boolean;
  size: SubtitleSize;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}

/**
 * Interactive subtitles, as subtitles look on a film: bold white lines, centred on a dark box.
 * The line being learned on top, with its phrases and words marked, and the Azerbaijani
 * translation in its yellow below a divider line.
 */
export function Subtitles({ segment, segmentIndex, showTranslation, size, selection, onSelect }: Props) {
  const s = SIZES[size];
  return (
    <div
      className="animate-fade-quick pointer-events-auto max-w-full self-center rounded-md bg-black/75 px-4 py-2.5 text-center"
      style={{ "--word-pad": `${s.pad}px` } as CSSProperties}
    >
      <p className="font-bold text-white" style={{ fontSize: s.text, lineHeight: `${s.line}px` }}>
        <SegmentText
          segment={segment}
          segmentIndex={segmentIndex}
          selection={selection}
          onSelect={onSelect}
          variant="subtitle"
        />
      </p>
      {showTranslation && segment.tr && (
        <p
          className="mt-1.5 border-t border-white/10 pt-1.5 font-medium text-translation"
          style={{ fontSize: s.tr, lineHeight: `${s.trLine}px` }}
        >
          {segment.tr}
        </p>
      )}
    </div>
  );
}

"use client";

import { cn } from "@/lib/cn";
import type { Segment } from "@/lib/types";
import type { Selection } from "@/lib/units";
import { OVERLAY_CARD, OVERLAY_PRIMARY_TEXT, OVERLAY_SECONDARY_TEXT } from "./overlay";
import { SegmentText } from "./SegmentText";

interface Props {
  segment: Segment;
  segmentIndex: number;
  showTranslation: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}

/**
 * Interactive subtitles, styled exactly like the channel/title card: English on top,
 * the Azerbaijani translation below a divider line.
 */
export function Subtitles({ segment, segmentIndex, showTranslation, selection, onSelect }: Props) {
  return (
    <div className={cn(OVERLAY_CARD, "pointer-events-auto px-3.5 py-2")}>
      <p className={cn(OVERLAY_PRIMARY_TEXT, "leading-6")}>
        <SegmentText segment={segment} segmentIndex={segmentIndex} selection={selection} onSelect={onSelect} />
      </p>
      {showTranslation && segment.tr && (
        <p className={cn(OVERLAY_SECONDARY_TEXT, "mt-1.5 border-t border-white/15 pt-1.5 leading-5 text-translation")}>
          {segment.tr}
        </p>
      )}
    </div>
  );
}

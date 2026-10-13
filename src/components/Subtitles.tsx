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
 * Interactive subtitles, on the same surface as the word sheet: the line being learned on top,
 * the Azerbaijani translation in its yellow below a divider line.
 */
export function Subtitles({ segment, segmentIndex, showTranslation, selection, onSelect }: Props) {
  return (
    <div className={cn(OVERLAY_CARD, "animate-fade-quick pointer-events-auto px-4 py-2.5")}>
      <p className={cn(OVERLAY_PRIMARY_TEXT, "leading-6")}>
        <SegmentText segment={segment} segmentIndex={segmentIndex} selection={selection} onSelect={onSelect} />
      </p>
      {showTranslation && segment.tr && (
        <p className={cn(OVERLAY_SECONDARY_TEXT, "mt-1.5 border-t border-white/[0.07] pt-1.5 font-medium leading-5 text-translation")}>
          {segment.tr}
        </p>
      )}
    </div>
  );
}

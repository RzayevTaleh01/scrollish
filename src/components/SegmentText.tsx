"use client";

import { Fragment, useMemo } from "react";
import { cn } from "@/lib/cn";
import type { Segment } from "@/lib/types";
import { buildUnits, type Selection } from "@/lib/units";

interface Props {
  segment: Segment;
  segmentIndex: number;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  /**
   * The subtitles on the video mark every target: a broken line under a phrase, a solid, fainter one
   * under a word that has a meaning to show, and the picked one white. The transcript marks phrases only.
   */
  variant?: "transcript" | "subtitle";
}

/** How a target looks in each place: picked, a phrase, a word with a meaning, a word without one. */
const LOOK = {
  transcript: {
    selected: "bg-accent text-accent-ink",
    phrase: "underline decoration-accent decoration-2 underline-offset-4 hover:bg-white/15",
    word: "hover:bg-white/15",
    plain: "hover:bg-white/15",
  },
  subtitle: {
    selected: "bg-white text-black",
    phrase: "underline decoration-accent decoration-dashed decoration-2 underline-offset-[5px] hover:bg-white/15",
    word: "underline decoration-accent/60 decoration-2 underline-offset-[5px] hover:bg-white/15",
    plain: "hover:bg-white/15",
  },
};

/**
 * The words of one segment as tap targets. A phrase is one target, every other word is its own.
 * `--word-pad` (set by the parent) is the space above and below each word that still counts as it.
 */
export function SegmentText({ segment, segmentIndex, selection, onSelect, variant = "transcript" }: Props) {
  const look = LOOK[variant];
  const units = useMemo(() => buildUnits(segment), [segment]);

  return units.map((unit) => {
    const selected = selection?.segment === segmentIndex && selection.from === unit.from && selection.to === unit.to;
    const text = segment.tokens
      .slice(unit.from, unit.to + 1)
      .map((t) => t.t)
      .join(" ");

    return (
      <Fragment key={unit.from}>
        <button
          type="button"
          onClick={() => onSelect({ segment: segmentIndex, ...unit })}
          className={cn(
            "-mx-0.5 rounded-md px-0.5 py-[var(--word-pad,2px)] text-left transition-colors",
            selected
              ? look.selected
              : unit.kind === "phrase"
                ? look.phrase
                : segment.words[unit.from]
                  ? look.word
                  : look.plain,
          )}
        >
          {text}
        </button>{" "}
      </Fragment>
    );
  });
}

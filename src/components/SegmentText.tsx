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
}

/** The words of one segment as tap targets. A phrase is one target, every other word is its own. */
export function SegmentText({ segment, segmentIndex, selection, onSelect }: Props) {
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
            "-mx-0.5 rounded-md px-0.5 py-0.5 text-left transition-colors",
            selected
              ? "bg-accent text-accent-ink"
              : unit.kind === "phrase"
                ? "underline decoration-accent decoration-2 underline-offset-4 hover:bg-white/15"
                : "hover:bg-white/15",
          )}
        >
          {text}
        </button>{" "}
      </Fragment>
    );
  });
}

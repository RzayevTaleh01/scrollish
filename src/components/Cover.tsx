"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Width of the image YouTube sends in place of a cover that does not exist. */
const PLACEHOLDER_WIDTH = 120;

/**
 * The cover of a Short in its own upright shape, up to 1080x1920. Some videos do not have one:
 * YouTube then answers with a tiny grey placeholder, and the small landscape cover is used instead.
 * Give it the video id as `key` wherever the same element is reused for another video.
 */
export function Cover({ id, className }: { id: string; className?: string }) {
  const [upright, setUpright] = useState(true);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://i.ytimg.com/vi/${id}/${upright ? "oar2" : "hqdefault"}.jpg`}
      alt=""
      draggable={false}
      onLoad={(e) => e.currentTarget.naturalWidth <= PLACEHOLDER_WIDTH && setUpright(false)}
      onError={() => setUpright(false)}
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}

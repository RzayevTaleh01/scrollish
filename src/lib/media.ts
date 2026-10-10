"use client";

import { useSyncExternalStore } from "react";

/** True while the CSS media query matches. False on the server and before hydration. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Wide enough for the transcript panel next to the video, like YouTube Shorts on desktop. */
export const WIDE_QUERY = "(min-width: 1024px)";

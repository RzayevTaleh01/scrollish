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

/**
 * A phone, or another device with little to spare. A YouTube player is a whole page of YouTube's
 * own code, and on such a device each one that is loaded is felt, so it gets fewer of them.
 */
export function isLeanDevice(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.matchMedia("(pointer: coarse), (max-width: 767px)").matches || (memory !== undefined && memory <= 4);
}

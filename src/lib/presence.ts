"use client";

import { useEffect, useState } from "react";

/** How long things take to leave, in milliseconds: the length of `animate-fade-out` and `animate-sink`. */
export const EXIT_MS = 200;

/**
 * Keeps something on the page for a moment after it is closed, so it can animate out rather than
 * vanish. `closing` is true during that moment; once it has passed, `mounted` turns false.
 */
export function usePresence(open: boolean, ms = EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(timer);
  }, [open, mounted, ms]);

  return { mounted, closing: mounted && !open };
}

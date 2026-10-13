"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { LikedVideo } from "@/lib/liked";
import { usePresence } from "@/lib/presence";
import { useSaved } from "@/lib/saved";
import { useSettings } from "@/lib/settings";
import { ACCENT, BUTTON_SECONDARY, PANEL_TITLE } from "./brand";
import { DictionaryView } from "./Dictionary";
import { LikedVideos } from "./Liked";

type Tab = "videos" | "words";

interface Props {
  open: boolean;
  liked: LikedVideo[];
  onOpenVideo: (video: LikedVideo) => void;
  onRemoveLike: (id: string) => void;
  onClose: () => void;
}

/** Everything kept along the way: the liked videos, and the dictionary with the saved words. */
export function Library({ open, liked, onOpenVideo, onRemoveLike, onClose }: Props) {
  const { mounted, closing } = usePresence(open);
  const saved = useSaved();
  const { language } = useSettings();
  const savedCount = saved.items.filter((i) => i.lang === language).length;
  const [tab, setTab] = useState<Tab>("videos");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "videos", label: "Videos", count: liked.length },
    { id: "words", label: "Words", count: savedCount },
  ];

  if (!mounted) return null;

  return (
    // Phones: above the navigation bar, which stays in reach. No blur there.
    <div
      className={cn(
        closing ? "pointer-events-none animate-fade-out" : "animate-fade-in",
        "fixed inset-x-0 top-0 bottom-[var(--nav-h)] z-40 flex flex-col bg-bg md:bg-black/75 md:backdrop-blur-2xl md:backdrop-saturate-150",
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
        <div className="px-4 pb-4 pt-[calc(14px+env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <h2 className={PANEL_TITLE}>Library</h2>
            <button
              onClick={onClose}
              aria-label="Close library"
              className={cn(BUTTON_SECONDARY, "size-10 max-md:hidden")}
            >
              <X size={20} />
            </button>
          </div>

          <div role="tablist" aria-label="Library" className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1 md:max-w-xs">
            {tabs.map(({ id, label, count }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "liquid flex h-9 items-center justify-center gap-2 rounded-md text-sm font-semibold",
                  tab === id ? "bg-white text-black" : "text-muted hover:text-white",
                )}
              >
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold",
                      tab === id ? ACCENT : "bg-surface-3 text-white",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Keyed by the tab, so switching fades the new list in rather than swapping it at once. */}
        <div key={tab} className="animate-fade-in flex min-h-0 flex-1 flex-col">
          {tab === "videos" ? (
            <LikedVideos items={liked} onOpen={onOpenVideo} onRemove={onRemoveLike} />
          ) : (
            <DictionaryView />
          )}
        </div>
      </div>
    </div>
  );
}

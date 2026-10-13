"use client";

import { House, Plus, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { MdOutlineVideoLibrary, MdVideoLibrary } from "react-icons/md";
import { SiYoutubeshorts } from "react-icons/si";
import { cn } from "@/lib/cn";
import { ACCENT, BAR } from "./brand";

/** The full-screen panels over the feed. None open means the feed itself, the Shorts tab. */
export type Panel = "library" | "profile";

interface Props {
  panel: Panel | null;
  onHome: () => void;
  onSelect: (panel: Panel | null) => void;
  onAdd: () => void;
}

const ICON = 22;

function Tab({
  label,
  selected = false,
  onClick,
  children,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "liquid flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
        selected ? "text-accent" : "text-muted active:text-white",
      )}
    >
      <span className="grid size-[22px] place-items-center">{children}</span>
      {label}
    </button>
  );
}

/**
 * Phones only: the tab bar, a flat tile floating above the bottom edge.
 * The panels open above it, so it stays in reach to go from one to another; it is drawn over
 * them, so the plus can rise above its top edge. The plus adds a video by its YouTube link.
 */
export function BottomNav({ panel, onHome, onSelect, onAdd }: Props) {
  return (
    <nav
      aria-label="Main"
      className={cn(BAR, "fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-[42] grid h-[52px] grid-cols-5 md:hidden")}
    >
      <Tab label="Home" onClick={onHome}>
        <House size={ICON} strokeWidth={2} />
      </Tab>
      <Tab label="Shorts" selected={panel === null} onClick={() => onSelect(null)}>
        <SiYoutubeshorts size={19} />
      </Tab>
      {/* Bigger than the tabs and with no label, rising a little above the bar (--nav-lift). */}
      <div className="relative">
        <button
          onClick={onAdd}
          aria-label="Add a video"
          className={cn(
            ACCENT,
            "liquid absolute left-1/2 top-[calc(-1*var(--nav-lift))] grid size-11 -translate-x-1/2 place-items-center rounded-full",
          )}
        >
          <Plus size={24} strokeWidth={2.6} />
        </button>
      </div>
      <Tab label="Library" selected={panel === "library"} onClick={() => onSelect("library")}>
        {panel === "library" ? <MdVideoLibrary size={ICON} /> : <MdOutlineVideoLibrary size={ICON} />}
      </Tab>
      <Tab label="Profile" selected={panel === "profile"} onClick={() => onSelect("profile")}>
        <UserRound size={ICON} strokeWidth={2} />
      </Tab>
    </nav>
  );
}

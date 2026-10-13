"use client";

import { BookCopy, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { topicsForLanguage } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { languageOf, type LanguageId } from "@/lib/languages";
import { TOPICS } from "@/lib/topics";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./brand";
import { Logo } from "./Logo";
import { ProfileIcon } from "./ProfileIcon";

interface Props {
  language: LanguageId;
  topic: string;
  onTopic: (id: string) => void;
  onHome: () => void;
  onOpenLibrary: () => void;
  onOpenProfile: () => void;
  onAdd: () => void;
  /** Phones: the video has grown up under the row (see Feed), which then sits over its top corner. */
  overVideo?: boolean;
  /** Phones: the chips have faded away, leaving the video the room; the logo stays. */
  chipsAway?: boolean;
}

/**
 * YouTube style filter chips. The white selection is one pill that slides from chip
 * to chip and stretches a little as it lands, which gives the bar its liquid feel.
 */
function Chips({ language, topic, onTopic }: Pick<Props, "language" | "topic" | "onTopic">) {
  const scroller = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Only topics that have channels in the language being learned.
  const chips = useMemo(() => {
    const available = new Set<string>(topicsForLanguage(language));
    const topics = TOPICS.filter((t) => available.has(t.id)).map((t) => ({
      id: t.id as string,
      label: t.id === "language" ? `Learn ${languageOf(language).label}` : t.label,
    }));
    return [{ id: "all", label: "All" }, ...topics];
  }, [language]);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);

    const chip = chipRefs.current.get(topic);
    if (!chip) return;
    const next = { x: chip.offsetLeft, width: chip.offsetWidth };
    setPill((prev) => (prev && prev.x === next.x && prev.width === next.width ? prev : next));
  }, [topic]);

  useLayoutEffect(() => {
    measure();
    chipRefs.current.get(topic)?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [measure, topic, chips]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Chip widths change once the web font arrives.
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [measure]);

  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    // Phones: all the room right of the logo. Desktop: as wide as the chips need and centred.
    // Either way they scroll sideways when they do not fit.
    <div className="pointer-events-auto relative w-full md:mx-auto md:w-fit md:max-w-full">
      <div
        ref={scroller}
        onScroll={measure}
        role="tablist"
        aria-label="Topics"
        className="no-scrollbar relative flex gap-2 overflow-x-auto md:gap-3"
      >
        {pill && (
          <span
            aria-hidden
            className="liquid-slide pointer-events-none absolute left-0 top-0 h-8 rounded-lg bg-white"
            style={{ transform: `translateX(${pill.x}px)`, width: pill.width }}
          />
        )}
        {chips.map((chip) => {
          const selected = topic === chip.id;
          return (
            <button
              key={chip.id}
              ref={(el) => {
                if (el) chipRefs.current.set(chip.id, el);
                else chipRefs.current.delete(chip.id);
              }}
              role="tab"
              aria-selected={selected}
              onClick={() => onTopic(chip.id)}
              className={cn(
                "liquid relative z-10 h-8 shrink-0 rounded-lg px-3 text-sm font-medium",
                selected ? "border border-transparent text-black" : "glass-chip text-white hover:bg-white/20",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {canLeft && (
        <div className="absolute inset-y-0 left-0 hidden items-center bg-bg pr-2 md:flex">
          <ArrowButton label="Scroll topics left" onClick={() => scrollBy(-1)}>
            <ChevronLeft size={20} />
          </ArrowButton>
        </div>
      )}
      {canRight && (
        <div className="absolute inset-y-0 right-0 hidden items-center bg-bg pl-2 md:flex">
          <ArrowButton label="Scroll topics right" onClick={() => scrollBy(1)}>
            <ChevronRight size={20} />
          </ArrowButton>
        </div>
      )}
    </div>
  );
}

function ArrowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="liquid grid size-8 place-items-center rounded-full hover:bg-white/15"
    >
      {children}
    </button>
  );
}

const HEADER_BUTTON = "h-9 shrink-0 px-3.5 text-sm";

/**
 * Phones: one row on the page background above the video, the logo on the left and the chips beside it.
 * The rest is in the bar along the bottom there (see BottomNav). Once the viewer has moved on down the
 * feed, the video grows up under the row: the logo stays over its corner and the chips go, coming back
 * over the video while it is stopped.
 * Desktop, like YouTube: the navigation row on top and the chips in their own row below it, above the video.
 */
export function TopBar({
  language,
  topic,
  onTopic,
  onHome,
  onOpenLibrary,
  onOpenProfile,
  onAdd,
  overVideo = false,
  chipsAway = false,
}: Props) {
  return (
    // Phones: no background of its own, and the row itself lets taps through to the video under it:
    // only the logo and the chips take them. Desktop: a solid full-width bar. The video starts below it.
    <header className="fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] max-md:pointer-events-none md:bg-bg">
      {/*
        Over the video the row moves in from its top corner, so the logo keeps the same space from the
        card's edges as the subtitles and buttons have: in the time the card grows (--header-h).
      */}
      <div
        className={cn(
          "mx-auto flex h-[var(--bar-h)] max-w-6xl items-center gap-3 pl-3 transition-[translate,padding] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none md:h-auto md:flex-wrap md:gap-y-0 md:px-4",
          overVideo && "max-md:translate-y-2.5 max-md:pl-5",
        )}
      >
        <button onClick={onHome} aria-label="Scrollish home" className="liquid pointer-events-auto shrink-0 rounded-xl md:mr-2">
          <Logo />
        </button>
        {/* Desktop: pushes the buttons to the right and sets the height of the navigation row. */}
        <div aria-hidden className="hidden flex-1 md:block md:h-16" />
        {/*
          The right padding on phones lets the last chip scroll clear of the screen edge. Away, they
          are also invisible, which keeps taps off them once they have faded (the change of visibility
          waits for the fade out, and comes at once on the way back in).
        */}
        <div
          className={cn(
            "min-w-0 flex-1 pr-3 transition-[translate,opacity,visibility] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none md:order-last md:basis-full md:pb-3 md:pr-0",
            chipsAway && "max-md:invisible max-md:-translate-y-2 max-md:opacity-0",
          )}
        >
          <Chips language={language} topic={topic} onTopic={onTopic} />
        </div>
        <button onClick={onAdd} className={cn(BUTTON_PRIMARY, HEADER_BUTTON, "max-md:hidden")}>
          <Plus size={18} />
          Add video
        </button>
        <button onClick={onOpenLibrary} className={cn(BUTTON_SECONDARY, HEADER_BUTTON, "max-md:hidden")}>
          <BookCopy size={18} />
          Library
        </button>
        <button onClick={onOpenProfile} className={cn(BUTTON_SECONDARY, HEADER_BUTTON, "max-md:hidden")}>
          <ProfileIcon size={18} />
          Profile
        </button>
      </div>
    </header>
  );
}

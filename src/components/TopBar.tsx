"use client";

import { BookOpen, ChevronLeft, ChevronRight, Heart, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { topicsForLanguage } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { languageOf, type LanguageId } from "@/lib/languages";
import { TOPICS } from "@/lib/topics";
import { Logo } from "./Logo";

interface Props {
  language: LanguageId;
  topic: string;
  onTopic: (id: string) => void;
  savedCount: number;
  /** Phones only: the header steps aside while a video plays. */
  hidden?: boolean;
  onHome: () => void;
  onOpenLiked: () => void;
  onOpenDictionary: () => void;
  onOpenSettings: () => void;
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
    // As wide as the chips need and centred, scrolling sideways when they do not fit.
    <div className="pointer-events-auto relative mx-auto w-fit max-w-full">
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
                "liquid relative z-10 h-8 shrink-0 rounded-lg border border-transparent px-3 text-sm font-medium",
                // Glass over the video on phones, a soft tile on the page background on desktop.
                selected ? "text-black" : "glass text-white hover:bg-white/15 md:glass-soft md:text-text",
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

const HEADER_BUTTON =
  "liquid glass-soft flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-white hover:bg-white/15 md:px-3.5";

/**
 * Phones: the logo and the buttons in the header, the chips centred and floating over the top of the video.
 * Desktop, like YouTube: the navigation row on top and the chips in their own row below it, above the video.
 */
export function TopBar({
  language,
  topic,
  onTopic,
  savedCount,
  hidden = false,
  onHome,
  onOpenLiked,
  onOpenDictionary,
  onOpenSettings,
}: Props) {
  return (
    // Phones: a floating card in the same glass as the subtitle card, with space on every side.
    // Desktop: a solid full-width bar, the video starts below it.
    // While hidden it fades and lifts away; `invisible` also takes its buttons out of reach.
    <header
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+8px)] transition-[opacity,translate,visibility] duration-300 md:pointer-events-auto md:bg-bg md:px-0 md:pt-[env(safe-area-inset-top)]",
        hidden && "max-md:invisible max-md:-translate-y-3 max-md:opacity-0",
      )}
    >
      <div className="pointer-events-auto mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 max-md:glass max-md:rounded-2xl md:h-auto md:flex-wrap md:gap-x-3 md:gap-y-0 md:px-4">
        <button onClick={onHome} aria-label="Scrollish home" className="liquid mr-1 rounded-xl md:mr-2">
          <Logo />
        </button>
        {/* Pushes the buttons to the right and, on desktop, sets the height of the navigation row. */}
        <div aria-hidden className="flex-1 md:h-16" />
        <div className="pointer-events-none absolute inset-x-0 top-full px-3 pt-2 md:pointer-events-auto md:static md:order-last md:basis-full md:px-0 md:pb-3 md:pt-0">
          <Chips language={language} topic={topic} onTopic={onTopic} />
        </div>
        <button onClick={onOpenLiked} aria-label="Liked videos" className={HEADER_BUTTON}>
          <Heart size={18} />
          <span className="hidden md:inline">Liked</span>
        </button>
        <button onClick={onOpenDictionary} aria-label="Dictionary" className={HEADER_BUTTON}>
          <BookOpen size={18} />
          <span className="hidden md:inline">Dictionary</span>
          {savedCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-ink">
              {savedCount}
            </span>
          )}
        </button>
        <button onClick={onOpenSettings} aria-label="Settings" className={HEADER_BUTTON}>
          <SettingsIcon size={18} />
          <span className="hidden md:inline">Settings</span>
        </button>
      </div>
    </header>
  );
}

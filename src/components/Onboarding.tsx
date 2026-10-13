"use client";

import { ArrowLeft, Check, Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { LANGUAGES } from "@/lib/languages";
import { usePresence } from "@/lib/presence";
import { useSettings } from "@/lib/settings";
import { LEVEL_NAME, LEVELS } from "@/lib/types";
import { BUTTON_PRIMARY, CHOICE, CHOICE_IDLE, CHOICE_PICKED, EYEBROW, HEADLINE } from "./brand";

interface Props {
  open: boolean;
  onBack: () => void;
  onDone: () => void;
}

/**
 * Asked once, between the home page and the first video: which language and which level.
 * Each answer is saved the moment it is picked, so the feed behind is already loading the right
 * videos while the other question is being answered. Both can be changed later in Settings.
 */
export function Onboarding({ open, onBack, onDone }: Props) {
  const { mounted, closing } = usePresence(open);
  const { language, level, setLanguage, setLevel } = useSettings();
  // The saved level may just be the default, so the question counts as open until it is answered here.
  const [answered, setAnswered] = useState(false);

  const pickLevel = (next: typeof level) => {
    setLevel(next);
    setAnswered(true);
  };

  if (!mounted) return null;

  return (
    // Everything fits on one screen, small phones included; scrolling is only left for a phone on its side.
    <div
      className={cn(
        closing ? "pointer-events-none animate-fade-out" : "animate-fade-in",
        "fixed inset-0 z-[60] overflow-y-auto bg-bg",
      )}
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))] md:px-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted hover:text-white"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <p className={cn(EYEBROW, "mt-6 short:hidden")}>Two questions before the first video</p>
        <h2 className={cn(HEADLINE, "mt-3 text-[28px] md:text-[42px] short:mt-5")}>What do you want to learn?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:mt-4 md:gap-3">
          {LANGUAGES.map((option) => (
            <Choice
              key={option.id}
              title={option.label}
              hint={option.native}
              selected={option.id === language}
              onClick={() => setLanguage(option.id)}
            />
          ))}
        </div>

        <h2 className={cn(HEADLINE, "mt-6 text-[28px] md:mt-8 md:text-[42px] short:md:mt-6")}>What is your level?</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 md:mt-4 md:gap-3">
          {LEVELS.map((option) => (
            <Choice
              key={option}
              title={option}
              hint={LEVEL_NAME[option]}
              selected={answered && level === option}
              onClick={() => pickLevel(option)}
              compact
            />
          ))}
        </div>
        <Choice
          title="Not sure"
          hint="Show videos of every level"
          selected={answered && level === null}
          onClick={() => pickLevel(null)}
          className="mt-2 md:mt-3"
        />
        <p className="mt-3 text-xs leading-relaxed text-muted md:text-sm short:hidden">
          Videos at your level come first. You can change both answers later in Settings.
        </p>

        <button
          onClick={onDone}
          disabled={!answered}
          className={cn(BUTTON_PRIMARY, "mt-6 h-12 shrink-0 gap-2.5 px-10 text-base md:mt-8 md:h-14 short:md:mt-6")}
        >
          <Play size={18} className="fill-current" />
          Start watching
        </button>
      </div>
    </div>
  );
}

function Choice({
  title,
  hint,
  selected,
  onClick,
  className,
  compact = false,
}: {
  title: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
  /** Three to a row on a phone: no room for the check mark there, the fill alone shows the choice. */
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        CHOICE,
        "flex items-center gap-3 py-2.5 md:px-4 md:py-3.5",
        compact ? "px-3" : "px-4",
        selected ? CHOICE_PICKED : CHOICE_IDLE,
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-tight md:text-lg">{title}</span>
        <span className={cn("mt-0.5 block text-[11px] leading-snug md:text-xs", selected ? "text-accent-ink/70" : "text-muted")}>
          {hint}
        </span>
      </span>
      {selected && <Check size={18} strokeWidth={2.5} className={cn("shrink-0", compact && "hidden md:block")} />}
    </button>
  );
}

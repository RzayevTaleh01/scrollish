"use client";

import { ArrowLeft, Check, Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { LANGUAGES } from "@/lib/languages";
import { useSettings } from "@/lib/settings";
import { LEVEL_NAME, LEVELS } from "@/lib/types";
import { EYEBROW, HEADLINE } from "./Landing";

interface Props {
  onBack: () => void;
  onDone: () => void;
}

/**
 * Asked once, between the home page and the first video: which language and which level.
 * Each answer is saved the moment it is picked, so the feed behind is already loading the right
 * videos while the other question is being answered. Both can be changed later in Settings.
 */
export function Onboarding({ onBack, onDone }: Props) {
  const { language, level, setLanguage, setLevel } = useSettings();
  // The saved level may just be the default, so the question counts as open until it is answered here.
  const [answered, setAnswered] = useState(false);

  const pickLevel = (next: typeof level) => {
    setLevel(next);
    setAnswered(true);
  };

  return (
    <div className="animate-fade-in fixed inset-0 z-[60] overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] md:px-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted hover:text-white"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <p className={cn(EYEBROW, "mt-8")}>Two questions before the first video</p>
        <h2 className={cn(HEADLINE, "mt-4 text-3xl md:text-5xl")}>What do you want to learn?</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
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

        <h2 className={cn(HEADLINE, "mt-10 text-3xl md:text-5xl")}>What is your level?</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {LEVELS.map((option) => (
            <Choice
              key={option}
              title={option}
              hint={LEVEL_NAME[option]}
              selected={answered && level === option}
              onClick={() => pickLevel(option)}
            />
          ))}
        </div>
        <Choice
          title="Not sure"
          hint="Show videos of every level"
          selected={answered && level === null}
          onClick={() => pickLevel(null)}
          className="mt-3"
        />
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Videos at your level come first. You can change both answers later in Settings.
        </p>

        <button
          onClick={onDone}
          disabled={!answered}
          className="liquid mt-8 inline-flex h-14 items-center justify-center gap-2.5 rounded-lg bg-white px-10 text-base font-semibold text-black disabled:opacity-40"
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
}: {
  title: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "liquid flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left",
        selected ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-accent",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{title}</span>
        <span className={cn("mt-0.5 block text-xs", selected ? "text-accent-ink/70" : "text-muted")}>{hint}</span>
      </span>
      {selected && <Check size={18} strokeWidth={2.5} className="shrink-0" />}
    </button>
  );
}

"use client";

import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { LANGUAGES } from "@/lib/languages";
import { useSettings } from "@/lib/settings";
import { LEVEL_NAME, LEVELS } from "@/lib/types";

export function Settings({ onClose }: { onClose: () => void }) {
  const { language, level, setLanguage, setLevel } = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="animate-fade-in fixed inset-0 z-40 flex flex-col bg-black/75 backdrop-blur-2xl backdrop-saturate-150">
      <div className="no-scrollbar mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="liquid glass-soft grid size-10 place-items-center rounded-full hover:bg-white/15"
          >
            <X size={20} />
          </button>
        </div>

        <section className="mt-7">
          <h3 className="text-sm font-semibold text-muted">I am learning</h3>
          <div className="mt-3 space-y-2">
            {LANGUAGES.map((option) => {
              const selected = option.id === language;
              return (
                <button
                  key={option.id}
                  onClick={() => setLanguage(option.id)}
                  aria-pressed={selected}
                  className={cn(
                    "liquid flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left",
                    selected ? "bg-accent text-accent-ink" : "glass-soft hover:bg-white/15",
                  )}
                >
                  <span className="flex-1">
                    <span className="block text-[17px] font-semibold">{option.label}</span>
                    <span className={cn("block text-sm", selected ? "text-accent-ink/70" : "text-muted")}>
                      {option.native}
                    </span>
                  </span>
                  {selected && <Check size={20} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Videos, subtitles and the dictionary follow this language. Translations stay in Azerbaijani.
          </p>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold text-muted">My level</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <LevelOption label="Any level" hint="Show every video" selected={level === null} onClick={() => setLevel(null)} />
            {LEVELS.map((option) => (
              <LevelOption
                key={option}
                label={option}
                hint={LEVEL_NAME[option]}
                selected={level === option}
                onClick={() => setLevel(option)}
              />
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Videos at your level come first. When there are not enough of them yet, nearby levels are added. The level of
            each video is an estimate made by AI.
          </p>
        </section>
      </div>
    </div>
  );
}

function LevelOption({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "liquid rounded-2xl px-4 py-3 text-left",
        selected ? "bg-accent text-accent-ink" : "glass-soft hover:bg-white/15",
      )}
    >
      <span className="block text-[17px] font-semibold">{label}</span>
      <span className={cn("block text-xs", selected ? "text-accent-ink/70" : "text-muted")}>{hint}</span>
    </button>
  );
}

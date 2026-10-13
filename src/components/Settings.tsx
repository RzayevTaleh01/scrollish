"use client";

import { Check, LogOut, UserRound, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAccount } from "@/lib/account";
import { cn } from "@/lib/cn";
import { languageOf, LANGUAGES } from "@/lib/languages";
import { usePresence } from "@/lib/presence";
import { useSaved } from "@/lib/saved";
import { SUBTITLE_SIZES, useSettings, type SubtitleSize } from "@/lib/settings";
import { LEVEL_NAME, LEVELS } from "@/lib/types";
import { ACCENT, BUTTON_SECONDARY, CHOICE, CHOICE_IDLE, CHOICE_PICKED, EYEBROW, HEADLINE, TILE } from "./brand";
import { LevelBadge } from "./LevelBadge";
import { ProfileIcon } from "./ProfileIcon";

/** The size choices, each with its name and the size of its "Aa", which shows the difference a little enlarged. */
const SUBTITLE_CHOICES: Record<SubtitleSize, { label: string; sample: number }> = {
  small: { label: "Small", sample: 16 },
  medium: { label: "Medium", sample: 20 },
  large: { label: "Large", sample: 24 },
};

interface Props {
  open: boolean;
  likedCount: number;
  onClose: () => void;
}

/**
 * The Profile tab: who is learning what, and the language and level, both kept in this browser.
 * Phones: one column. Desktop: a page, the summary on the left and the choices beside it.
 */
export function Settings({ open, likedCount, onClose }: Props) {
  const { mounted, closing } = usePresence(open);
  const { language, level, subtitleSize, setLanguage, setLevel, setSubtitleSize } = useSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        closing ? "pointer-events-none animate-fade-out" : "animate-fade-in",
        "fixed inset-x-0 top-0 bottom-[var(--nav-h)] z-40 flex flex-col bg-bg",
      )}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-4 pb-6 pt-[calc(14px+env(safe-area-inset-top))] md:max-w-5xl md:px-8 md:pb-12 md:pt-[calc(40px+env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <h2 className={cn(HEADLINE, "text-3xl md:text-5xl")}>Profile</h2>
            <button onClick={onClose} aria-label="Close profile" className={cn(BUTTON_SECONDARY, "size-10 max-md:hidden")}>
              <X size={20} />
            </button>
          </div>

          <div className="mt-6 md:mt-10 md:grid md:grid-cols-[300px_minmax(0,1fr)] md:items-start md:gap-10">
            <Summary likedCount={likedCount} />

            <div className="mt-8 space-y-8 md:mt-0 md:space-y-10">
              <section>
                <h3 className={EYEBROW}>I am learning</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2 md:gap-3">
                  {LANGUAGES.map((option) => {
                    const selected = option.id === language;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setLanguage(option.id)}
                        aria-pressed={selected}
                        className={cn(
                          CHOICE,
                          "flex w-full items-center gap-3 px-4 py-3.5 md:py-5",
                          selected ? CHOICE_PICKED : CHOICE_IDLE,
                        )}
                      >
                        <span className="flex-1">
                          <span className="block text-[17px] font-semibold md:text-lg">{option.label}</span>
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

              <section>
                <h3 className={EYEBROW}>My level</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                  <LevelOption
                    label="Any level"
                    hint="Show every video"
                    selected={level === null}
                    onClick={() => setLevel(null)}
                  />
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
                  Videos at your level come first. When there are not enough of them yet, nearby levels are added. The
                  level of each video is an estimate made by AI.
                </p>
              </section>

              <section>
                <h3 className={EYEBROW}>Subtitle size</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
                  {SUBTITLE_SIZES.map((size) => {
                    const selected = size === subtitleSize;
                    const { label, sample } = SUBTITLE_CHOICES[size];
                    return (
                      <button
                        key={size}
                        onClick={() => setSubtitleSize(size)}
                        aria-pressed={selected}
                        className={cn(
                          CHOICE,
                          "flex flex-col items-center justify-end gap-1.5 px-3 py-3 md:py-4",
                          selected ? CHOICE_PICKED : CHOICE_IDLE,
                        )}
                      >
                        <span aria-hidden className="font-semibold leading-none" style={{ fontSize: sample }}>
                          Aa
                        </span>
                        <span className={cn("text-xs", selected ? "text-accent-ink/70" : "text-muted")}>{label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  For the subtitles on the video. Bigger ones are easier to read and to tap, smaller ones cover less of
                  the picture.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Who is learning: the language and level picked, and what has been kept so far. */
function Summary({ likedCount }: { likedCount: number }) {
  const { language, level } = useSettings();
  const saved = useSaved();
  const savedCount = saved.items.filter((i) => i.lang === language).length;

  return (
    <div className={cn(TILE, "p-5 md:sticky md:top-0")}>
      <div className="flex items-center gap-4">
        <span className={cn(ACCENT, "grid size-14 shrink-0 place-items-center rounded-lg")}>
          <UserRound size={28} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className={EYEBROW}>Learning</p>
          <p className="mt-1 truncate text-xl font-bold">{languageOf(language).label}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {level ? (
              <>
                <LevelBadge level={level} />
                {LEVEL_NAME[level]}
              </>
            ) : (
              "Any level"
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 border-t border-line pt-4">
        <Stat value={likedCount} label="Liked videos" />
        <Stat value={savedCount} label="Saved words" />
      </div>
      <AccountSection />
    </div>
  );
}

/**
 * The Google account: who is signed in and a way out, or Google's button to sign in. Without Google
 * sign-in set up on the server, only the note that everything is kept in this browser.
 */
function AccountSection() {
  const { account, renderButton, signOut } = useAccount();

  if (account) {
    return (
      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center gap-3">
          <ProfileIcon size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{account.name}</p>
            <p className="truncate text-sm text-muted">{account.email}</p>
          </div>
        </div>
        <button onClick={signOut} className={cn(BUTTON_SECONDARY, "mt-4 h-10 w-full text-sm")}>
          <LogOut size={16} />
          Sign out
        </button>
        <p className="mt-3 text-xs leading-relaxed text-muted">Likes and saved words are kept in this browser.</p>
      </div>
    );
  }

  if (renderButton) {
    return (
      <div className="mt-4 border-t border-line pt-4">
        <GoogleButton render={renderButton} />
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Sign in with Google, or go on without an account: likes and saved words are kept in this browser.
        </p>
      </div>
    );
  }

  return <p className="mt-4 text-xs leading-relaxed text-muted">Kept in this browser. No account needed.</p>;
}

/** Google draws its own button: it holds the height of one meanwhile, so nothing jumps when it arrives. */
function GoogleButton({ render }: { render: (parent: HTMLElement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) render(ref.current);
  }, [render]);
  return <div ref={ref} className="h-10 w-full overflow-hidden" />;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
      <p className={cn(EYEBROW, "mt-1")}>{label}</p>
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
      className={cn(CHOICE, "px-4 py-3 md:py-4", selected ? CHOICE_PICKED : CHOICE_IDLE)}
    >
      <span className="block text-[17px] font-semibold">{label}</span>
      <span className={cn("block text-xs", selected ? "text-accent-ink/70" : "text-muted")}>{hint}</span>
    </button>
  );
}

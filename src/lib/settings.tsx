"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SETTINGS_KEY } from "./boot";
import { DEFAULT_LANGUAGE, isLanguageId, type LanguageId } from "./languages";
import { LEVELS, type Level } from "./types";

/** How big the subtitles on the video are. */
export const SUBTITLE_SIZES = ["small", "medium", "large"] as const;
export type SubtitleSize = (typeof SUBTITLE_SIZES)[number];

export interface Settings {
  /** The language the viewer is learning. */
  language: LanguageId;
  /** The viewer's level, or null for videos of every level. */
  level: Level | null;
  subtitleSize: SubtitleSize;
}

interface SettingsContext extends Settings {
  /** False until the saved settings have been read, so nothing loads with the wrong language first. */
  ready: boolean;
  setLanguage: (language: LanguageId) => void;
  setLevel: (level: Level | null) => void;
  setSubtitleSize: (size: SubtitleSize) => void;
}

const DEFAULTS: Settings = { language: DEFAULT_LANGUAGE, level: null, subtitleSize: "medium" };
const Context = createContext<SettingsContext | null>(null);

function read(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      language: isLanguageId(stored.language) ? stored.language : DEFAULTS.language,
      level: LEVELS.includes(stored.level) ? stored.level : null,
      subtitleSize: SUBTITLE_SIZES.includes(stored.subtitleSize) ? stored.subtitleSize : DEFAULTS.subtitleSize,
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(read());
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Kept the same from one render to the next, so what depends on one setting is not redone when another changes.
  const setLanguage = useCallback((language: LanguageId) => update({ language }), [update]);
  const setLevel = useCallback((level: Level | null) => update({ level }), [update]);
  const setSubtitleSize = useCallback((subtitleSize: SubtitleSize) => update({ subtitleSize }), [update]);

  const value = useMemo<SettingsContext>(
    () => ({ ...settings, ready, setLanguage, setLevel, setSubtitleSize }),
    [settings, ready, setLanguage, setLevel, setSubtitleSize],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSettings(): SettingsContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, isLanguageId, type LanguageId } from "./languages";
import { LEVELS, type Level } from "./types";

export interface Settings {
  /** The language the viewer is learning. */
  language: LanguageId;
  /** The viewer's level, or null for videos of every level. */
  level: Level | null;
}

interface SettingsContext extends Settings {
  /** False until the saved settings have been read, so nothing loads with the wrong language first. */
  ready: boolean;
  setLanguage: (language: LanguageId) => void;
  setLevel: (level: Level | null) => void;
}

const STORAGE_KEY = "socialearn:settings";
const DEFAULTS: Settings = { language: DEFAULT_LANGUAGE, level: null };
const Context = createContext<SettingsContext | null>(null);

function read(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      language: isLanguageId(stored.language) ? stored.language : DEFAULTS.language,
      level: LEVELS.includes(stored.level) ? stored.level : null,
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo<SettingsContext>(
    () => ({
      ...settings,
      ready,
      setLanguage: (language) => update({ language }),
      setLevel: (level) => update({ level }),
    }),
    [settings, ready, update],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSettings(): SettingsContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

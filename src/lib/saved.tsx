"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE } from "./languages";
import type { Level } from "./types";

export interface SavedItem {
  key: string;
  /** Language of the term, ISO code. */
  lang: string;
  term: string;
  kind: "word" | "phrase";
  surface: string;
  pos: string;
  level: Level;
  az: string;
  en: string;
  example: string;
  exampleTr: string;
  videoId: string | null;
  savedAt: number;
}

interface SavedContext {
  items: SavedItem[];
  has: (key: string) => boolean;
  toggle: (item: Omit<SavedItem, "savedAt">) => void;
}

const STORAGE_KEY = "socialearn:saved";
const Context = createContext<SavedContext | null>(null);

export const savedKey = (lang: string, kind: "word" | "phrase", term: string) =>
  `${lang}:${kind}:${term.toLowerCase()}`;

/** Items saved before languages existed have no language: they were all English. */
function upgrade(stored: unknown): SavedItem[] {
  if (!Array.isArray(stored)) return [];
  return stored.map((item: SavedItem) => {
    const lang = item.lang ?? DEFAULT_LANGUAGE;
    return { ...item, lang, key: savedKey(lang, item.kind, item.term) };
  });
}

export function SavedProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    try {
      setItems(upgrade(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")));
    } catch {}
  }, []);

  const toggle = useCallback((item: Omit<SavedItem, "savedAt">) => {
    setItems((prev) => {
      const exists = prev.some((p) => p.key === item.key);
      const next = exists ? prev.filter((p) => p.key !== item.key) : [{ ...item, savedAt: Date.now() }, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo<SavedContext>(() => {
    const keys = new Set(items.map((i) => i.key));
    return { items, has: (key) => keys.has(key), toggle };
  }, [items, toggle]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSaved(): SavedContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSaved must be used inside SavedProvider");
  return ctx;
}

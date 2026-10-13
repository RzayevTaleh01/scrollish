"use client";

import { Bookmark, ChevronDown, Search, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { languageOf } from "@/lib/languages";
import { savedKey, useSaved, type SavedItem } from "@/lib/saved";
import { useSettings } from "@/lib/settings";
import { speak } from "@/lib/speak";
import type { DictEntry } from "@/lib/types";
import { ACCENT, TILE } from "./brand";
import { EntrySkeleton } from "./Skeleton";
import { LevelBadge } from "./LevelBadge";

type Tab = "all" | "saved";
type KindFilter = "all" | "word" | "phrase";

const PAGE = 30;
const KIND_CHIPS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "word", label: "Words" },
  { id: "phrase", label: "Phrases" },
];

interface Row {
  key: string;
  lang: string;
  term: string;
  kind: "word" | "phrase";
  pos: string;
  level: DictEntry["level"];
  az: string;
  alt: string[];
  en: string;
  example: string;
  exampleTr: string;
  videoId: string | null;
}

const fromEntry = (e: DictEntry, lang: string): Row => ({ ...e, lang, key: savedKey(lang, e.kind, e.term) });
const fromSaved = (s: SavedItem): Row => ({ ...s, alt: [] });

const CHIP = "liquid h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium";
const BUTTON = "liquid flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium";
const SOFT = "border border-line bg-surface hover:border-accent";

/** Every word and phrase met so far, and the ones saved, in the Library. */
export function DictionaryView() {
  const saved = useSaved();
  const { language } = useSettings();
  const savedHere = useMemo(() => saved.items.filter((s) => s.lang === language), [saved.items, language]);
  const [tab, setTab] = useState<Tab>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "all") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          lang: language,
          q: query.trim(),
          kind,
          limit: String(PAGE),
          offset: "0",
        });
        const res = await fetch(`/api/dictionary?${params}`, { signal: controller.signal });
        const data: { items: DictEntry[]; total: number } = await res.json();
        setEntries(data.items);
        setTotal(data.total);
      } catch {
        // aborted or offline, keep the previous list
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [tab, kind, query, language]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lang: language,
        q: query.trim(),
        kind,
        limit: String(PAGE),
        offset: String(entries.length),
      });
      const res = await fetch(`/api/dictionary?${params}`);
      const data: { items: DictEntry[]; total: number } = await res.json();
      setEntries((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo<Row[]>(() => {
    if (tab === "all") return entries.map((e) => fromEntry(e, language));
    const q = query.trim().toLowerCase();
    return savedHere
      .filter((s) => kind === "all" || s.kind === kind)
      .filter((s) => !q || s.term.includes(q) || s.az.toLowerCase().includes(q))
      .map(fromSaved);
  }, [tab, entries, savedHere, kind, query, language]);

  return (
    <>
      <div className="px-4 pb-3">
        <label className="flex h-11 cursor-text items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 focus-within:border-accent">
          <Search size={18} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${languageOf(language).label} or Azerbaijani`}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
        </label>

        <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4">
          {(["all", "saved"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(CHIP, tab === t ? "bg-white text-black" : cn(SOFT, "text-text"))}
            >
              {t === "all" ? "All" : `Saved (${savedHere.length})`}
            </button>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          {KIND_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setKind(chip.id)}
              className={cn(CHIP, kind === chip.id ? ACCENT : "text-muted hover:text-white")}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 md:pb-[calc(24px+env(safe-area-inset-bottom))]">
        {rows.length === 0 && (tab === "saved" || !loading) && (
          <p className="mt-16 text-center text-sm text-muted">
            {tab === "saved"
              ? "Nothing saved yet. Tap a word or phrase in the subtitles, then the bookmark."
              : "No matches. The dictionary fills up as videos are analysed."}
          </p>
        )}

        <ul className="space-y-2">
          {tab === "all" && loading && rows.length === 0 && Array.from({ length: 7 }, (_, i) => <EntrySkeleton key={i} />)}
          {rows.map((row) => (
            <EntryCard
              key={row.key}
              row={row}
              open={openKey === row.key}
              onToggle={() => setOpenKey(openKey === row.key ? null : row.key)}
            />
          ))}
        </ul>

        {tab === "all" && entries.length < total && (
          <button
            onClick={loadMore}
            disabled={loading}
            className={cn("liquid mx-auto mt-4 block h-10 rounded-lg px-6 text-sm font-medium disabled:opacity-50", SOFT)}
          >
            {loading ? "Loading..." : `Show more (${total - entries.length})`}
          </button>
        )}
      </div>
    </>
  );
}

function EntryCard({ row, open, onToggle }: { row: Row; open: boolean; onToggle: () => void }) {
  const { has, toggle } = useSaved();
  const { language } = useSettings();
  const isSaved = has(row.key);

  const onSave = () =>
    toggle({
      key: row.key,
      lang: row.lang,
      term: row.term,
      kind: row.kind,
      surface: row.term,
      pos: row.pos,
      level: row.level,
      az: row.az,
      en: row.en,
      example: row.example,
      exampleTr: row.exampleTr,
      videoId: row.videoId,
    });

  return (
    <li className={cn(TILE, "overflow-hidden")}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-semibold">{row.term}</span>
            {row.pos && <span className="text-xs text-muted">{row.pos}</span>}
            <LevelBadge level={row.level} />
            {row.kind === "phrase" && (
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-accent-ink">
                PHRASE
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[15px] text-translation">{row.az}</p>
        </div>
        {isSaved && <Bookmark size={16} className="shrink-0 fill-accent text-accent" />}
        <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="animate-fade-in space-y-3 border-t border-line px-4 pb-4 pt-3">
          {row.en && <p className="text-sm text-muted">{row.en}</p>}
          {row.alt.length > 0 && (
            <p className="text-sm text-muted">
              Also: <span className="text-translation">{row.alt.join(", ")}</span>
            </p>
          )}
          {row.example && (
            <div className="rounded-lg bg-bg p-3">
              <p className="text-[15px] leading-relaxed">{row.example}</p>
              {row.exampleTr && <p className="mt-1 text-sm text-muted">{row.exampleTr}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => speak(row.term, languageOf(language).speech)}
              className={cn(BUTTON, SOFT)}
            >
              <Volume2 size={16} /> Pronounce
            </button>
            <button
              onClick={onSave}
              className={cn(BUTTON, isSaved ? ACCENT : SOFT)}
            >
              <Bookmark size={16} className={isSaved ? "fill-current" : ""} />
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

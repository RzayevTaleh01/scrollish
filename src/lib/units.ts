import type { Level, Phrase, PhraseKind, Segment } from "./types";

/** What the viewer tapped: a single word, or a whole phrase (collocation, idiom, phrasal verb). */
export interface Selection {
  segment: number;
  from: number;
  to: number;
  kind: "word" | "phrase";
}

export interface Unit {
  from: number;
  to: number;
  kind: "word" | "phrase";
}

export const PHRASE_LABEL: Record<PhraseKind, string> = {
  collocation: "Collocation",
  idiom: "Idiom",
  "phrasal verb": "Phrasal verb",
  expression: "Expression",
};

/** Splits a segment into tappable units: every phrase is ONE unit, other tokens are single words. */
export function buildUnits(segment: Segment): Unit[] {
  const units: Unit[] = [];
  const phraseAt = new Map<number, Phrase>(segment.phrases.map((p) => [p.from, p]));

  for (let i = 0; i < segment.tokens.length; i++) {
    const phrase = phraseAt.get(i);
    if (phrase) {
      units.push({ from: phrase.from, to: phrase.to, kind: "phrase" });
      i = phrase.to;
    } else {
      units.push({ from: i, to: i, kind: "word" });
    }
  }
  return units;
}

export interface Resolved {
  kind: "word" | "phrase";
  term: string;
  surface: string;
  pos: string;
  level: Level | null;
  az: string;
  en: string;
  phrase: Phrase | null;
  /** Phrase that contains this word, so the viewer can jump back to the whole expression. */
  parent: Phrase | null;
  words: { index: number; surface: string }[];
}

const trimEdges = (text: string) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

export function resolveSelection(segment: Segment, selection: Selection): Resolved {
  const slice = segment.tokens.slice(selection.from, selection.to + 1);

  if (selection.kind === "phrase") {
    const phrase = segment.phrases.find((p) => p.from === selection.from && p.to === selection.to) ?? null;
    return {
      kind: "phrase",
      term: phrase?.lemma ?? slice.map((t) => t.w.toLowerCase()).join(" "),
      surface: trimEdges(slice.map((t) => t.t).join(" ")),
      pos: phrase ? PHRASE_LABEL[phrase.kind] : "Expression",
      level: phrase?.lvl ?? null,
      az: phrase?.az ?? "",
      en: phrase?.en ?? "",
      phrase,
      parent: null,
      words: slice.map((t, k) => ({ index: selection.from + k, surface: t.w })),
    };
  }

  const token = segment.tokens[selection.from];
  const gloss = segment.words[selection.from];
  return {
    kind: "word",
    term: gloss?.lemma ?? token.w.toLowerCase(),
    surface: token.w,
    pos: gloss?.pos ?? "",
    level: gloss?.lvl ?? null,
    az: gloss?.az ?? "",
    en: "",
    phrase: null,
    parent: segment.phrases.find((p) => p.from <= selection.from && selection.from <= p.to) ?? null,
    words: [],
  };
}

export const sentenceOf = (segment: Segment) => segment.tokens.map((t) => t.t).join(" ");

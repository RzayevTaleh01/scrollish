import type { Phrase, Token, WordGloss } from "./types";

/** Words in a phrase's base form that only stand for whatever goes there ("pick someone up"). */
const PLACEHOLDERS = new Set([
  "someone",
  "somebody",
  "something",
  "sb",
  "sth",
  "ones",
  "oneself",
  "niekto",
  "niekoho",
  "niekomu",
  "nieco",
  "niecoho",
]);
/** Articles change with the sentence ("take a picture", "took this picture"), so they are not looked for. */
const ARTICLES = new Set(["a", "an", "the"]);
/** How far outside the marked words the real ones are looked for. */
const REACH = 3;
const MAX_WORDS = 6;

/** A word reduced to what can be compared: lowercase letters without accents. */
const plain = (word: string) =>
  word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\p{L}]/gu, "");

/** The same word, give or take an ending. */
function alike(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shared = Math.min(a.length, b.length, 4);
  return shared >= 3 && a.slice(0, shared) === b.slice(0, shared);
}

/**
 * The model that picks the phrases gives each one as a first and a last word number, and it
 * miscounts now and then: "kept up" comes back marked on "necessarily kept", one word to the left.
 * This puts the marks back on the words the phrase is made of. The base form of the phrase says
 * which words those are ("keep up"), and every word of the line has its own base form to compare
 * with ("kept" is "keep"), so the right words can be found near the marked ones.
 * A phrase whose words cannot all be found is left exactly as it was.
 */
export function snapPhrase(tokens: Token[], words: Record<number, WordGloss>, phrase: Phrase): Phrase {
  const lemma = phrase.lemma.split(/\s+/).map(plain).filter(Boolean);
  const parts = lemma.filter((part) => !PLACEHOLDERS.has(part) && !ARTICLES.has(part));
  if (parts.length < 2) return phrase;

  const matches = (index: number, part: string) =>
    alike(plain(tokens[index].w), part) || alike(plain(words[index]?.lemma ?? ""), part);

  const lo = Math.max(0, phrase.from - REACH);
  const hi = Math.min(tokens.length - 1, phrase.to + REACH);
  let best: { from: number; to: number; overlap: number } | null = null;

  for (let from = lo; from <= hi; from++) {
    if (!matches(from, parts[0])) continue;
    // The remaining words in order, each at the first place it fits.
    let at = from;
    let found = true;
    for (const part of parts.slice(1)) {
      at++;
      while (at <= hi && !matches(at, part)) at++;
      if (at > hi) {
        found = false;
        break;
      }
    }
    if (!found || at - from >= MAX_WORDS) continue;
    const overlap = Math.min(at, phrase.to) - Math.max(from, phrase.from) + 1;
    if (!best || overlap > best.overlap || (overlap === best.overlap && at - from < best.to - best.from)) {
      best = { from, to: at, overlap };
    }
  }

  if (!best) return phrase;
  // An article the phrase opens with ("a lot of") belongs to it when it is standing right there.
  let { from } = best;
  for (let i = lemma.findIndex((part) => !ARTICLES.has(part)) - 1; i >= 0 && from > 0; i--) {
    if (plain(tokens[from - 1].w) !== lemma[i]) break;
    from--;
  }
  if ((from === phrase.from && best.to === phrase.to) || best.to - from >= MAX_WORDS) return phrase;
  return { ...phrase, from, to: best.to };
}

/** Every phrase of a line put on its own words. A correction that would run into another phrase is not made. */
export function snapPhrases(tokens: Token[], words: Record<number, WordGloss>, phrases: Phrase[]): Phrase[] {
  const taken = new Set<number>();
  const result: Phrase[] = [];
  for (const phrase of phrases) {
    const snapped = snapPhrase(tokens, words, phrase);
    const span = (p: Phrase) => Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i);
    const pick = span(snapped).some((i) => taken.has(i)) ? phrase : snapped;
    if (span(pick).some((i) => taken.has(i))) continue;
    span(pick).forEach((i) => taken.add(i));
    result.push(pick);
  }
  return result.sort((a, b) => a.from - b.from);
}

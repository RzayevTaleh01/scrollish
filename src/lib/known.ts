import { segmentsByLanguage } from "./db";
import type { Segment, WordGloss } from "./types";

/** Word classes whose translation hardly depends on the sentence (the, to, and, you...). */
const CLOSED_CLASS = new Set(["det", "pron", "prep", "conj", "aux", "part", "num", "interj"]);
/** Other words count as known once this many videos agree on their translation. */
const MIN_VIDEOS = 2;
const MIN_AGREEMENT = 0.8;

interface FormStats {
  videos: number;
  byMeaning: Map<string, { videos: number; gloss: WordGloss }>;
}

/**
 * Remembers how words were translated in the videos analysed so far, so the same word
 * is not sent to Gemini again in the next video. That repetition is most of the work:
 * about 7 out of 10 words in a new video were already translated before.
 */
class KnownWords {
  private readonly forms = new Map<string, FormStats>();

  addVideo(segments: Segment[]) {
    const seen = new Map<string, WordGloss>();
    for (const segment of segments) {
      segment.tokens.forEach((token, i) => {
        const gloss = segment.words[i];
        const form = token.w.toLowerCase();
        if (gloss && !seen.has(form)) seen.set(form, gloss);
      });
    }
    for (const [form, gloss] of seen) {
      const stats = this.forms.get(form) ?? { videos: 0, byMeaning: new Map() };
      stats.videos++;
      const entry = stats.byMeaning.get(gloss.az) ?? { videos: 0, gloss };
      entry.videos++;
      stats.byMeaning.set(gloss.az, entry);
      this.forms.set(form, stats);
    }
  }

  /** The translations that are safe to reuse for the given word forms. */
  lookup(forms: Iterable<string>): Map<string, WordGloss> {
    const known = new Map<string, WordGloss>();
    for (const form of forms) {
      const stats = this.forms.get(form);
      if (!stats) continue;
      const top = [...stats.byMeaning.values()].sort((a, b) => b.videos - a.videos)[0];
      const stable = stats.videos >= MIN_VIDEOS && top.videos / stats.videos >= MIN_AGREEMENT;
      if (CLOSED_CLASS.has(top.gloss.pos) || stable) known.set(form, top.gloss);
    }
    return known;
  }
}

const g = globalThis as unknown as { __socialearnKnown?: Map<string, Promise<KnownWords>> };
const cache = (g.__socialearnKnown ??= new Map<string, Promise<KnownWords>>());

/** Built once per language from the database, then kept up to date as videos are saved. */
export function knownWords(lang: string): Promise<KnownWords> {
  let pending = cache.get(lang);
  if (!pending) {
    pending = segmentsByLanguage(lang).then((videos) => {
      const known = new KnownWords();
      videos.forEach((segments) => known.addVideo(segments));
      return known;
    });
    cache.set(lang, pending);
  }
  return pending;
}

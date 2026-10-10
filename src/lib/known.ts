import { segmentsByLanguage } from "./db";
import { videoLevel } from "./segments";
import { LEVELS, type Level, type Segment, type WordGloss } from "./types";

/** Word classes whose translation hardly depends on the sentence (the, to, and, you...). */
const CLOSED_CLASS = new Set(["det", "pron", "prep", "conj", "aux", "part", "num", "interj"]);
/** Other words count as known once this many videos agree on their translation. */
const MIN_VIDEOS = 2;
const MIN_AGREEMENT = 0.8;
/** A level needs this many analysed videos before new videos can be recognised as that level. */
const MIN_LEVEL_SAMPLES = 3;

/** A guess at the level of a video that was not analysed, and the levels a guess can come out as. */
export interface LevelGuess {
  level: Level;
  guessable: Level[];
}

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
  /** The words of every analysed video with its level: what the level guesses are measured against. */
  private readonly videos: { level: Level; forms: string[] }[] = [];
  private typical: Map<Level, number> | null = null;

  addVideo(segments: Segment[]) {
    this.videos.push({ level: videoLevel(segments), forms: wordForms(segments) });
    this.typical = null;

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

  /**
   * The share of a video's words that are everyday (A1) words met in at least `minVideos` videos.
   * Easy videos are made almost entirely of them, harder ones are diluted by rarer and unseen words.
   */
  private easyShare(forms: string[], minVideos: number): number {
    if (!forms.length) return 0;
    let easy = 0;
    for (const form of forms) {
      const stats = this.forms.get(form);
      if (!stats || stats.videos < minVideos) continue;
      const top = [...stats.byMeaning.values()].sort((a, b) => b.videos - a.videos)[0];
      if (top.gloss.lvl === LEVELS[0]) easy++;
    }
    return easy / forms.length;
  }

  /** The usual easy share of the analysed videos of each level (the median), for levels with enough videos. */
  private typicalShares(): Map<Level, number> {
    if (this.typical) return this.typical;
    const typical = new Map<Level, number>();
    for (const level of LEVELS) {
      // A video's own words do not count as met before: they must appear in another video too.
      const shares = this.videos.filter((v) => v.level === level).map((v) => this.easyShare(v.forms, 2));
      if (shares.length < MIN_LEVEL_SAMPLES) continue;
      shares.sort((a, b) => a - b);
      typical.set(level, shares[Math.floor(shares.length / 2)]);
    }
    return (this.typical = typical);
  }

  /**
   * Guesses the level of a video from its captions alone, without Gemini: the level whose analysed
   * videos have the most similar share of everyday words. Rough, but on English it finds beginner
   * videos about four times as often as picking blindly. Null until two levels have enough videos.
   */
  guessLevel(forms: string[]): LevelGuess | null {
    const typical = this.typicalShares();
    if (typical.size < 2 || !forms.length) return null;

    const share = this.easyShare(forms, 1);
    const [level] = [...typical].sort((a, b) => Math.abs(a[1] - share) - Math.abs(b[1] - share))[0];
    return { level, guessable: [...typical.keys()] };
  }
}

/** The words of a video in lowercase, one entry per occurrence, numbers and symbols left out. */
export function wordForms(segments: { tokens: { w: string }[] }[]): string[] {
  return segments.flatMap((s) => s.tokens.map((t) => t.w.toLowerCase())).filter((form) => /\p{L}/u.test(form));
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

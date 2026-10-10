import type { Cue } from "./transcript";
import type { Level, Segment, Token } from "./types";
import { LEVELS } from "./types";

export interface RawSegment {
  start: number;
  end: number;
  text: string;
  tokens: Token[];
}

const SENTENCE_END = /[.!?…]["'”’)\]]*$/;
const SOFT_BREAK = /[,;:]["'”’)\]]*$/;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const CONJUNCTION_BREAK_CHARS = 55;
const SOFT_BREAK_CHARS = 70;
const HARD_BREAK_CHARS = 130;
/** Conjunctions a long sentence may be split in front of, per language. */
const BREAK_BEFORE: Record<string, Set<string>> = {
  en: new Set(["and", "but", "so", "because", "then", "which", "when", "while", "although"]),
  sk: new Set(["a", "ale", "lebo", "pretože", "potom", "keď", "takže", "alebo", "aby"]),
};
const MIN_SENTENCE_WORDS = 3;
const MAX_GAP_SECONDS = 1.5;

interface TimedWord {
  text: string;
  start: number;
  end: number;
}

function clean(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[♪♫]+/g, " ")
    .replace(/>>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const chunk of text.split(/\s+/)) {
    if (!chunk) continue;
    const w = chunk.replace(EDGE_PUNCTUATION, "");
    if (w) tokens.push({ t: chunk, w });
    else if (tokens.length) tokens[tokens.length - 1].t += ` ${chunk}`;
  }
  return tokens;
}

/** Spreads each caption cue's time over its words, so segments can start and end mid-cue. */
function timedWords(cues: Cue[]): TimedWord[] {
  const words: TimedWord[] = [];

  for (const cue of cues) {
    const text = clean(cue.text);
    if (!text) continue;

    const duration = Math.max(cue.end - cue.start, 0.2);
    let offset = 0;
    for (const part of text.split(" ")) {
      const start = cue.start + (offset / text.length) * duration;
      offset += part.length + 1;
      const end = cue.start + (Math.min(offset, text.length) / text.length) * duration;
      words.push({ text: part, start, end });
    }
  }
  return words;
}

/**
 * Cuts the captions into sentence-sized segments (a sentence is the unit that gets translated)
 * and gives every segment its own start and end time.
 */
export function buildRawSegments(cues: Cue[], lang: string): RawSegment[] {
  const conjunctions = BREAK_BEFORE[lang] ?? new Set<string>();
  const segments: { start: number; end: number; text: string }[] = [];
  let current: TimedWord[] = [];
  let length = 0;

  const flush = () => {
    if (!current.length) return;
    segments.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((w) => w.text).join(" "),
    });
    current = [];
    length = 0;
  };

  for (const word of timedWords(cues)) {
    const previous = current[current.length - 1];
    if (previous && word.start - previous.end > MAX_GAP_SECONDS) flush();

    // A long sentence is easier to read and translate when it starts a new line at a conjunction.
    const bare = word.text.toLowerCase().replace(/[^\p{L}]/gu, "");
    if (length >= CONJUNCTION_BREAK_CHARS && conjunctions.has(bare)) flush();

    current.push(word);
    length += word.text.length + 1;

    const sentenceEnd = SENTENCE_END.test(word.text) && current.length >= MIN_SENTENCE_WORDS;
    const softBreak = length >= SOFT_BREAK_CHARS && SOFT_BREAK.test(word.text);
    if (sentenceEnd || softBreak || length >= HARD_BREAK_CHARS) flush();
  }
  flush();

  return segments
    .map((s) => ({ ...s, tokens: tokenize(s.text) }))
    .filter((s) => s.tokens.length > 0);
}

/** Smallest CEFR level that covers at least 90% of the glossed words in the video. */
export function videoLevel(segments: Segment[]): Level {
  const counts = new Map<Level, number>();
  let total = 0;
  for (const segment of segments) {
    for (const gloss of Object.values(segment.words)) {
      counts.set(gloss.lvl, (counts.get(gloss.lvl) ?? 0) + 1);
      total++;
    }
  }
  if (!total) return "B1";

  let covered = 0;
  for (const level of LEVELS) {
    covered += counts.get(level) ?? 0;
    if (covered / total >= 0.9) return level;
  }
  return "C2";
}

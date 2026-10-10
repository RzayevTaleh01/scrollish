export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const LEVEL_NAME: Record<Level, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

export interface Short {
  id: string;
  /** Language spoken in the video, ISO code. */
  lang: string;
  title: string;
  channelId: string;
  channelTitle: string;
  avatar: string;
  topics: string[];
  duration: number;
  captions: boolean;
}

export interface FeedItem {
  id: string;
  title: string;
  channelTitle: string;
  avatar: string;
  topics: string[];
  duration: number;
  level: Level | null;
  index: number;
}

export interface FeedResponse {
  items: FeedItem[];
  nextOffset: number;
  total: number;
  /** Why the video a link asked for is not among the items, in words for the viewer. */
  notice?: string;
}

/** The video a link asked for is in another language: the feed has to be asked for in that one. */
export interface FeedRedirect {
  language: string;
}

export interface FeedPending {
  pending: true;
  /** Set when what is being prepared is one video, opened by its link. */
  video?: string;
  ready: number;
  running: boolean;
  error: string | null;
}

export interface Token {
  /** Text as shown, punctuation included. */
  t: string;
  /** Bare word without surrounding punctuation. */
  w: string;
}

export type PhraseKind = "collocation" | "idiom" | "phrasal verb" | "expression";

export interface WordGloss {
  lemma: string;
  pos: string;
  lvl: Level;
  az: string;
}

export interface Phrase {
  from: number;
  to: number;
  kind: PhraseKind;
  lvl: Level;
  lemma: string;
  en: string;
  az: string;
}

export interface Segment {
  start: number;
  end: number;
  tokens: Token[];
  /** Azerbaijani translation of the whole segment. */
  tr: string;
  /** Gloss per token index. */
  words: Record<number, WordGloss>;
  phrases: Phrase[];
}

export interface VideoContent {
  id: string;
  level: Level;
  segments: Segment[];
}

export interface DictEntry {
  term: string;
  kind: "word" | "phrase";
  pos: string;
  level: Level;
  az: string;
  alt: string[];
  en: string;
  example: string;
  exampleTr: string;
  videoId: string | null;
  uses: number;
}

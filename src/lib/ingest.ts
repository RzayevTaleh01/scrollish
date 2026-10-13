import { topicsForLanguage } from "./channels";
import {
  markVideo,
  readyVideos,
  saveReadyVideo,
  videoStatuses,
  type ReadyVideo,
  type StatusRow,
  type VideoRow,
  type VideoStatus,
} from "./db";
import { analyzeVideos, GeminiError, hasGeminiKey, transcribeVideo, type SpokenLine } from "./gemini";
import { knownWords, wordForms } from "./known";
import { isLanguageId, LANGUAGES, languageOf, type LanguageId } from "./languages";
import { buildRawSegments, videoLevel, type RawSegment } from "./segments";
import {
  NoCaptionsError,
  NoTranscriptError,
  TranscriptBlockedError,
  fetchSpokenTranscript,
  fetchTranscript,
  type Transcript,
} from "./transcript";
import { LEVELS, type Level, type Segment, type Short } from "./types";
import { fetchVideo, getPool } from "./youtube";

const TARGET_PER_TOPIC = Number(process.env.INGEST_PER_TOPIC) || 8;
/**
 * Once every topic is filled, analysis goes on until each level has this many videos, so a viewer
 * who picked a level gets a feed of that level. Only videos whose captions look like a missing
 * level are sent to Gemini.
 */
const TARGET_PER_LEVEL = Number(process.env.INGEST_PER_LEVEL) || 12;
/** Upper limit of analysed videos per language, whatever the levels still missing. */
const MAX_VIDEOS = Number(process.env.INGEST_MAX) || 200;
/**
 * The guess from the captions is rough, and for some levels it hardly works at all. After this many
 * analysed videos in a row that turned out not to be a missing level, the search stops until the
 * server restarts, instead of spending the Gemini allowance on videos the feed has plenty of.
 */
const HUNT_PATIENCE = 12;

/** Videos sent to Gemini in one request. The free tier counts requests, so this is the main saving. */
const PACK_VIDEOS = Number(process.env.INGEST_PACK) || 4;
/** Keeps one answer comfortably inside the model's output limit. */
const PACK_SEGMENTS = 70;
const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 15 * 60 * 1000;
const MAX_QUOTA_PAUSE_MS = 60 * 60 * 1000;
/** How long the worker waits after YouTube refused to hand out captions to this server. */
const BLOCKED_PAUSE_MS = 30 * 60 * 1000;
const MIN_SEGMENTS = 3;
const MIN_WORDS = 20;

interface IngestState {
  running: boolean;
  /** What the viewer is looking at right now: this language and topic get analysed first. */
  lang: LanguageId;
  topic: string;
  /** The level the viewer picked in Settings: it is filled before the other levels. */
  level: Level | null;
  inFlight: Set<string>;
  lastError: string | null;
  cooldownUntil: number;
  /** Videos analysed for a missing level, in a row, that turned out to be another one. */
  missed?: number;
}

interface Prepared {
  short: Short;
  /** The level guessed from the captions, when the video was picked to fill a level. */
  estimate: Level | null;
  /** The levels the video was hoped to fill, or null when it was picked for another reason. */
  wanted: Level[] | null;
  kind: "manual" | "auto";
  raw: RawSegment[];
}

const g = globalThis as unknown as { __socialearnIngest4?: IngestState };
const state: IngestState = (g.__socialearnIngest4 ??= {
  running: false,
  lang: "en",
  topic: "all",
  level: null,
  inFlight: new Set(),
  lastError: null,
  cooldownUntil: 0,
});

export function ingestProgress() {
  return { running: state.running, error: state.lastError };
}

/**
 * Starts the background worker if it is idle. Only the language being watched is analysed,
 * and every video goes to Gemini at most once.
 */
export function kickIngest(lang: LanguageId, topic: string, level: Level | null = null) {
  state.lang = lang;
  state.topic = topic;
  state.level = level;
  if (state.running || !hasGeminiKey() || Date.now() < state.cooldownUntil) return;

  state.running = true;
  void run()
    .catch((err) => {
      state.lastError = err instanceof Error ? err.message : String(err);
      // Being refused by YouTube affects every video alike: pause rather than try video after video.
      if (err instanceof TranscriptBlockedError) state.cooldownUntil = Date.now() + BLOCKED_PAUSE_MS;
      console.error("[ingest]", state.lastError);
    })
    .finally(() => {
      state.running = false;
    });
}

async function run() {
  const pool = await getPool();

  try {
    while (Date.now() >= state.cooldownUntil) {
      const lang = state.lang;
      const pack = await preparePack(pool, lang);
      if (!pack.length) return;

      try {
        await analysePack(pack, lang);
        state.lastError = null;
      } catch (err) {
        await handleFailure(pack, err);
      } finally {
        pack.forEach((p) => state.inFlight.delete(p.short.id));
      }
    }
  } finally {
    state.inFlight.clear();
  }
}

function eligible(short: Short, statuses: Map<string, StatusRow>): boolean {
  if (state.inFlight.has(short.id)) return false;
  const row = statuses.get(short.id);
  if (!row || row.status === "deferred") return true;
  return row.status === "failed" && row.attempts < MAX_ATTEMPTS && Date.now() - row.updatedAt > RETRY_AFTER_MS;
}

/** A video to analyse next. `wanted` lists the levels it is hoped to fill, or is null when it fills a topic. */
interface Pick {
  short: Short;
  wanted: Level[] | null;
}

/**
 * Whether a guessed level is one the feed is short of. A missing level that cannot be guessed yet
 * (too few analysed videos of it) is stood in for by the nearest level that can.
 */
function fits(estimate: Level, wanted: Level[], guessable: Level[]): boolean {
  const nearest = (level: Level) =>
    [...guessable].sort(
      (a, b) =>
        Math.abs(LEVELS.indexOf(a) - LEVELS.indexOf(level)) - Math.abs(LEVELS.indexOf(b) - LEVELS.indexOf(level)),
    )[0];
  return wanted.some((level) => nearest(level) === estimate);
}

/** The levels that still have too few videos, the viewer's own level first, then the emptiest. */
function missingLevels(ready: ReadyVideo[]): Level[] {
  const counts = new Map<Level, number>();
  for (const video of ready) if (video.level) counts.set(video.level, (counts.get(video.level) ?? 0) + 1);

  return LEVELS.filter((level) => (counts.get(level) ?? 0) < TARGET_PER_LEVEL).sort((a, b) => {
    if (a === state.level) return -1;
    if (b === state.level) return 1;
    return (counts.get(a) ?? 0) - (counts.get(b) ?? 0);
  });
}

/**
 * How promising a video is for the levels still missing, smaller is better: a video whose captions
 * were already read and fit comes first, then channels whose analysed videos sit near those levels.
 */
function levelScore(short: Short, wanted: Level[], statuses: Map<string, StatusRow>, ready: ReadyVideo[]): number {
  if (statuses.get(short.id)?.status === "deferred") return -1;

  const seen = ready.filter((v) => v.channelId === short.channelId && v.level);
  // A channel with nothing analysed yet is taken for B1, or A2 when it teaches the language.
  const usual = seen.length
    ? seen.reduce((sum, v) => sum + LEVELS.indexOf(v.level as Level), 0) / seen.length
    : short.topics.includes("language")
      ? 1
      : 2;
  // The viewer's own level decides when it is one of the missing ones, otherwise any missing level will do.
  const targets = state.level && wanted.includes(state.level) ? [state.level] : wanted;
  return Math.min(...targets.map((level) => Math.abs(usual - LEVELS.indexOf(level))));
}

async function pickNext(pool: Short[], lang: LanguageId): Promise<Pick | null> {
  const [statuses, analysed, known] = await Promise.all([videoStatuses(), readyVideos(lang, "all"), knownWords(lang)]);
  // Videos opened by their link belong to no topic and are not part of the feed: they do not count here.
  const ready = analysed.filter((v) => v.topics.length);

  const counts: Record<string, number> = {};
  for (const video of ready) video.topics.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
  // Videos already in the pack being built count as ready, so a topic is not overfilled.
  for (const id of state.inFlight) {
    const short = pool.find((s) => s.id === id);
    short?.topics.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
  }

  const topics = (topicsForLanguage(lang) as string[])
    .filter((t) => (counts[t] ?? 0) < TARGET_PER_TOPIC)
    .sort((a, b) => {
      if (a === state.topic) return -1;
      if (b === state.topic) return 1;
      return (counts[a] ?? 0) - (counts[b] ?? 0);
    });

  for (const topic of topics) {
    const candidates = pool
      .filter((s) => s.lang === lang && s.topics.includes(topic) && eligible(s, statuses))
      .sort((a, b) => Number(b.captions) - Number(a.captions) || Math.random() - 0.5);
    if (candidates.length) return { short: candidates[0], wanted: null };
  }

  // Every topic is filled: go on for the levels that are still thin.
  const wanted = missingLevels(ready);
  if (!wanted.length || ready.length + state.inFlight.size >= MAX_VIDEOS) return null;
  if ((state.missed ?? 0) >= HUNT_PATIENCE) return null;

  const guessable = known.guessLevel(["a"])?.guessable;
  const candidates = pool
    .filter((s) => {
      if (s.lang !== lang || !eligible(s, statuses)) return false;
      const row = statuses.get(s.id);
      // Captions read before: only worth another look when the guess fits a level missing now.
      return row?.status !== "deferred" || !row.level || !guessable || fits(row.level, wanted, guessable);
    })
    .map((short) => ({ short, score: levelScore(short, wanted, statuses, ready) + Math.random() * 0.25 }))
    .sort((a, b) => a.score - b.score || Number(b.short.captions) - Number(a.short.captions));
  return candidates.length ? { short: candidates[0].short, wanted } : null;
}

/** Reads the captions of one video. Videos without usable captions are recorded and skipped for good. */
async function prepare({ short, wanted }: Pick): Promise<Prepared | null> {
  let transcript;
  try {
    transcript = await fetchTranscript(short.id, short.lang);
  } catch (err) {
    // Not the video's fault: leave it unrecorded and let the worker pause.
    if (err instanceof TranscriptBlockedError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    await markVideo(short, err instanceof NoTranscriptError ? "no_captions" : "failed", message);
    return null;
  }

  const raw = buildRawSegments(transcript.cues, short.lang);
  const words = raw.reduce((n, s) => n + s.tokens.length, 0);
  if (raw.length < MIN_SEGMENTS || words < MIN_WORDS) {
    await markVideo(short, "too_short", `${raw.length} segments, ${words} words`);
    return null;
  }

  let estimate: Level | null = null;
  if (wanted) {
    const guess = (await knownWords(short.lang)).guessLevel(wordForms(raw));
    estimate = guess?.level ?? null;
    // Looks like a level the feed has enough of: keep the guess and spend Gemini on another video.
    if (guess && !fits(guess.level, wanted, guess.guessable)) {
      await markVideo(short, "deferred", `looks like ${estimate}, wanted ${wanted.join(" ")}`, estimate);
      return null;
    }
  }
  return { short, estimate, wanted, kind: transcript.kind, raw };
}

/** Collects the next few videos that have captions, up to what fits in one request. */
async function preparePack(pool: Short[], lang: LanguageId): Promise<Prepared[]> {
  const pack: Prepared[] = [];
  let segments = 0;

  while (pack.length < PACK_VIDEOS) {
    const next = await pickNext(pool, lang);
    if (!next) break;

    state.inFlight.add(next.short.id);
    const prepared = await prepare(next);
    if (!prepared) {
      state.inFlight.delete(next.short.id);
      continue;
    }
    if (pack.length && segments + prepared.raw.length > PACK_SEGMENTS) {
      state.inFlight.delete(next.short.id);
      break;
    }
    pack.push(prepared);
    segments += prepared.raw.length;
  }
  return pack;
}

async function analysePack(pack: Prepared[], lang: LanguageId) {
  const known = await knownWords(lang);
  const forms = pack.flatMap((p) => p.raw.flatMap((s) => s.tokens.map((t) => t.w.toLowerCase())));
  const language = isLanguageId(lang) ? languageOf(lang).label : lang;

  const { analysis, model } = await analyzeVideos(
    pack.map((p) => ({ id: p.short.id, segments: p.raw })),
    language,
    known.lookup(new Set(forms)),
  );

  for (const { short, kind, raw, estimate, wanted } of pack) {
    const result = analysis.get(short.id);
    if (!result) {
      await markVideo(short, "failed", "Gemini answer for this video was incomplete");
      continue;
    }
    // Words and phrases met before take the level they already have, so it is the same in every video.
    const segments: Segment[] = known.settle(
      raw.map((segment, i) => ({
        start: segment.start,
        end: segment.end,
        tokens: segment.tokens,
        tr: result[i].tr,
        words: result[i].words,
        phrases: result[i].phrases,
      })),
    );
    const level = videoLevel(segments);
    await saveReadyVideo(short, kind, level, segments, model);
    if (estimate) console.log(`[ingest] ${short.id} guessed ${estimate}, is ${level}`);
    if (wanted) state.missed = wanted.includes(level) ? 0 : (state.missed ?? 0) + 1;
    known.addVideo(segments);
  }
}

async function handleFailure(pack: Prepared[], err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  if (err instanceof GeminiError) {
    // Quota or key problems affect every video, so pause instead of burning attempts.
    if (err.retryAt) {
      const time = new Date(err.retryAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
      state.lastError = `Every Gemini key and model is used up or busy. Analysis of new videos continues after ${time}.`;
      state.cooldownUntil = Math.min(err.retryAt, Date.now() + MAX_QUOTA_PAUSE_MS);
    } else {
      state.lastError = `Gemini ${err.status}: ${message.slice(0, 160)}`;
      state.cooldownUntil = Date.now() + 5 * 60 * 1000;
    }
    console.error("[ingest]", state.lastError);
    return;
  }

  console.error("[ingest]", message);
  for (const { short } of pack) await markVideo(short, "failed", message);
}

/**
 * Videos opened by their link (/shorts/<id>) that were never analysed. They are prepared one by one
 * as they are asked for, next to the worker rather than in its queue, so the viewer is not kept waiting.
 */
interface Requests {
  inFlight: Set<string>;
  /** Why a video could not be prepared just now, and when it may be tried again. */
  waiting: Map<string, { until: number; error: string }>;
  /** When the last requests were started: anyone can open a link, and each new video costs a Gemini request. */
  started: number[];
}

const gr = globalThis as unknown as { __socialearnRequests?: Requests };
const requests: Requests = (gr.__socialearnRequests ??= { inFlight: new Set(), waiting: new Map(), started: [] });

/** Longer videos are not Shorts, and their subtitles would not fit one Gemini answer. */
const REQUEST_MAX_SECONDS = 180;
const REQUESTS_AT_ONCE = 2;
const REQUESTS_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

/** What to tell a viewer whose video will never be ready, by the state it ended in. */
const UNAVAILABLE: Partial<Record<VideoStatus, string>> = {
  no_captions: "This video has no subtitles in a language Scrollish teaches",
  too_short: "This video has too little speech to learn from",
};

export type RequestOutcome = { pending: true; error: string | null } | { pending: false; reason: string };

/**
 * Asks for a video that is not ready to be prepared, and says where that stands: under way (with
 * the reason for a delay, if any), or not possible for this video.
 */
export function requestVideo(id: string, preferred: LanguageId, row: VideoRow | null): RequestOutcome {
  if (row?.status === "rejected") return { pending: false, reason: row.error ?? "This video cannot be opened here" };
  const unavailable = row && UNAVAILABLE[row.status];
  if (unavailable) return { pending: false, reason: unavailable };
  if (row?.status === "failed" && row.attempts >= MAX_ATTEMPTS) {
    return { pending: false, reason: "This video could not be prepared" };
  }
  if (!hasGeminiKey()) return { pending: false, reason: "New videos cannot be prepared right now" };

  const now = Date.now();
  if (requests.inFlight.has(id)) return { pending: true, error: null };
  const wait = requests.waiting.get(id);
  if (wait && wait.until > now) return { pending: true, error: wait.error };
  if (requests.inFlight.size >= REQUESTS_AT_ONCE) return { pending: true, error: null };
  requests.started = requests.started.filter((t) => now - t < HOUR_MS);
  if (requests.started.length >= REQUESTS_PER_HOUR) {
    return { pending: true, error: "Many new videos are being prepared right now. This one starts as soon as there is room." };
  }

  requests.started.push(now);
  requests.inFlight.add(id);
  requests.waiting.delete(id);
  void prepareRequested(id, preferred)
    .catch((err) => {
      console.error("[request]", id, err instanceof Error ? err.message : err);
      if (err instanceof TranscriptBlockedError) {
        requests.waiting.set(id, {
          until: Date.now() + 5 * 60 * 1000,
          error: "YouTube is not letting this server read the subtitles right now. It will be tried again in a few minutes.",
        });
      } else if (err instanceof GeminiError) {
        requests.waiting.set(id, {
          until: err.retryAt ? Math.min(err.retryAt, Date.now() + MAX_QUOTA_PAUSE_MS) : Date.now() + 60 * 1000,
          error: "The translation service is busy or has used up its allowance for now. It will be tried again later.",
        });
      } else {
        requests.waiting.set(id, { until: Date.now() + 30 * 1000, error: "This video could not be prepared yet. Trying again shortly." });
      }
    })
    .finally(() => requests.inFlight.delete(id));
  return { pending: true, error: null };
}

/** Nobody speaks faster than this for a whole line. */
const MAX_WORDS_PER_SECOND = 6;

/**
 * Counts the signs that a transcript made by Gemini went wrong: lines too dense to have been
 * spoken (text that was on screen got mixed in, or the times are off), and speech that stops
 * well before the video does (the end was left out). A video that ends on music also shows the
 * second sign, so this only decides whether another attempt is worth it, never that a video is bad.
 */
function flaws(cues: SpokenLine[], duration: number): number {
  const rushed = cues.filter((c) => c.text.split(/\s+/).length / Math.max(0.1, c.end - c.start) > MAX_WORDS_PER_SECOND);
  const last = cues[cues.length - 1];
  const cutShort = !last || (duration > 0 && last.start < duration * 0.8);
  return rushed.length + (cutShort ? 1 : 0);
}

/**
 * Lines that start after the video has ended cannot be right. When a transcript made by Gemini
 * runs past the end, its clock ran at the wrong speed, and every time is scaled back to fit.
 */
function fitToLength<T extends { start: number; end: number }>(cues: T[], duration: number): T[] {
  const last = cues[cues.length - 1];
  if (!last || duration <= 0 || last.start < duration) return cues;
  const scale = duration / last.end;
  return cues.map((cue) => ({ ...cue, start: cue.start * scale, end: cue.end * scale }));
}

/**
 * Looks the video up on YouTube, reads its captions (which also tell its language) and analyses it.
 * A video that can never be shown is recorded as such. Trouble that is not the video's fault is
 * thrown, and the caller has it tried again later.
 */
async function prepareRequested(id: string, preferred: LanguageId) {
  const found = await fetchVideo(id);
  const short: Short = {
    id,
    lang: preferred,
    title: found?.title ?? "",
    channelId: found?.channelId ?? "",
    channelTitle: found?.channelTitle ?? "",
    avatar: found?.avatar ?? "",
    topics: [],
    duration: found?.duration ?? 0,
    captions: found?.captions ?? false,
  };
  if (!found) return markVideo(short, "rejected", "YouTube does not know this video");
  if (!found.playable) return markVideo(short, "rejected", "This video cannot be played outside YouTube");
  if (found.duration > REQUEST_MAX_SECONDS) {
    return markVideo(short, "rejected", "Only videos of up to 3 minutes can be opened here");
  }

  const languages = [preferred, ...LANGUAGES.map((l) => l.id as string).filter((l) => l !== preferred)];
  let transcript: Transcript & { lang: string };
  try {
    transcript = await fetchSpokenTranscript(id, languages);
  } catch (err) {
    // YouTube will not give this server the captions (it refuses data centres), or the video has none.
    // Gemini is then asked to watch the video and write down what is said. That costs a request more.
    if (!(err instanceof TranscriptBlockedError) && !(err instanceof NoCaptionsError)) {
      const message = err instanceof Error ? err.message : String(err);
      return markVideo(short, err instanceof NoTranscriptError ? "no_captions" : "failed", message);
    }
    try {
      let heard = await transcribeVideo(id, languages);
      if (isLanguageId(heard.lang) && flaws(heard.cues, found.duration) > 0) {
        // It does not always come out right. One more go, and the cleaner of the two is kept.
        const again = await transcribeVideo(id, languages).catch(() => null);
        if (again && flaws(again.cues, found.duration) < flaws(heard.cues, found.duration)) heard = again;
      }
      transcript = { cues: fitToLength(heard.cues, found.duration), kind: "auto", lang: heard.lang };
    } catch (failure) {
      if (failure instanceof GeminiError) throw failure;
      return markVideo(short, "failed", failure instanceof Error ? failure.message : String(failure));
    }
  }
  if (!isLanguageId(transcript.lang)) return markVideo(short, "no_captions", `the video is in "${transcript.lang}"`);
  short.lang = transcript.lang;

  const raw = buildRawSegments(transcript.cues, short.lang);
  const words = raw.reduce((n, s) => n + s.tokens.length, 0);
  if (raw.length < MIN_SEGMENTS || words < MIN_WORDS) {
    return markVideo(short, "too_short", `${raw.length} segments, ${words} words`);
  }

  try {
    await analysePack([{ short, estimate: null, wanted: null, kind: transcript.kind, raw }], transcript.lang);
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    await markVideo(short, "failed", err instanceof Error ? err.message : String(err));
  }
}

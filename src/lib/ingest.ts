import { topicsForLanguage } from "./channels";
import { readyCountByTopic, markVideo, saveReadyVideo, videoStatuses, type StatusRow } from "./db";
import { analyzeVideos, GeminiError, hasGeminiKey } from "./gemini";
import { knownWords } from "./known";
import { isLanguageId, languageOf, type LanguageId } from "./languages";
import { buildRawSegments, videoLevel, type RawSegment } from "./segments";
import { NoTranscriptError, TranscriptBlockedError, fetchTranscript } from "./transcript";
import type { Segment, Short } from "./types";
import { getPool } from "./youtube";

const TARGET_PER_TOPIC = Number(process.env.INGEST_PER_TOPIC) || 8;
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
  inFlight: Set<string>;
  lastError: string | null;
  cooldownUntil: number;
}

interface Prepared {
  short: Short;
  kind: "manual" | "auto";
  raw: RawSegment[];
}

const g = globalThis as unknown as { __socialearnIngest3?: IngestState };
const state: IngestState = (g.__socialearnIngest3 ??= {
  running: false,
  lang: "en",
  topic: "all",
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
export function kickIngest(lang: LanguageId, topic: string) {
  state.lang = lang;
  state.topic = topic;
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
  if (!row) return true;
  return row.status === "failed" && row.attempts < MAX_ATTEMPTS && Date.now() - row.updatedAt > RETRY_AFTER_MS;
}

async function pickNext(pool: Short[], lang: LanguageId): Promise<Short | null> {
  const [statuses, counts] = await Promise.all([videoStatuses(), readyCountByTopic(lang)]);

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
    if (candidates.length) return candidates[0];
  }
  return null;
}

/** Reads the captions of one video. Videos without usable captions are recorded and skipped for good. */
async function prepare(short: Short): Promise<Prepared | null> {
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
  return { short, kind: transcript.kind, raw };
}

/** Collects the next few videos that have captions, up to what fits in one request. */
async function preparePack(pool: Short[], lang: LanguageId): Promise<Prepared[]> {
  const pack: Prepared[] = [];
  let segments = 0;

  while (pack.length < PACK_VIDEOS) {
    const next = await pickNext(pool, lang);
    if (!next) break;

    state.inFlight.add(next.id);
    const prepared = await prepare(next);
    if (!prepared) {
      state.inFlight.delete(next.id);
      continue;
    }
    if (pack.length && segments + prepared.raw.length > PACK_SEGMENTS) {
      state.inFlight.delete(next.id);
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

  for (const { short, kind, raw } of pack) {
    const result = analysis.get(short.id);
    if (!result) {
      await markVideo(short, "failed", "Gemini answer for this video was incomplete");
      continue;
    }
    const segments: Segment[] = raw.map((segment, i) => ({
      start: segment.start,
      end: segment.end,
      tokens: segment.tokens,
      tr: result[i].tr,
      words: result[i].words,
      phrases: result[i].phrases,
    }));
    await saveReadyVideo(short, kind, videoLevel(segments), segments, model);
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

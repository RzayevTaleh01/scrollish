import type { RawSegment } from "./segments";
import type { Level, Phrase, PhraseKind, WordGloss } from "./types";
import { LEVELS } from "./types";

const API_ROOT = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 240_000;

/**
 * Tried in order, for every key: when a model is overloaded, retired or out of quota,
 * the next one takes over. Free limits are counted per model and per day in REQUESTS
 * (about 20 a day for a full Flash model, far more for Lite), not in tokens.
 * So the better Flash models go first and the Lite ones are the reserve.
 */
const MODELS = (
  process.env.GEMINI_MODEL ||
  "gemini-3.5-flash,gemini-3.7-flash,gemini-flash-latest,gemini-3.6-flash,gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-3.1-flash-lite"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** Reasoning effort. This is a lookup style task: thinking only costs tokens and time. "off" omits the setting. */
const THINKING_LEVEL = process.env.GEMINI_THINKING || "minimal";

/** A per-minute limit shorter than this is simply waited out. */
const MAX_INLINE_WAIT_MS = 20_000;

// How long a key and model pair rests after an error, as in LangVis.
const REST_DAILY_LIMIT_MS = 60 * 60 * 1000;
const REST_GONE_MS = 24 * 60 * 60 * 1000;
const REST_BUSY_MS = 60 * 1000;
const REST_BAD_KEY_MS = 10 * 60 * 1000;

const KINDS: PhraseKind[] = ["collocation", "idiom", "phrasal verb", "expression"];

const text = { type: "string" };
const int = { type: "integer" };
const list = (properties: Record<string, object>) => ({
  type: "array",
  items: { type: "object", properties, required: Object.keys(properties) },
});

/**
 * The exact shape of the answer. Handing it to the API makes even the small Lite models
 * return valid JSON every time, which a prompt alone does not guarantee on long answers.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    v: list({
      n: int,
      g: list({ f: text, l: text, p: text, c: text, a: text }),
      s: list({
        i: int,
        tr: text,
        p: list({ f: int, t: int, k: text, c: text, l: text, e: text, a: text }),
        x: list({ i: int, a: text }),
      }),
    }),
  },
  required: ["v"],
};

/** Request options a model turned down, so they are not sent to it again. */
const withoutThinking = new Set<string>();
const withoutSchema = new Set<string>();

/** When each key and model pair may be tried again. Kept across dev reloads. */
const globalForGemini = globalThis as unknown as { __socialearnResting?: Map<string, number> };
const resting = (globalForGemini.__socialearnResting ??= new Map<string, number>());

export interface SegmentAnalysis {
  tr: string;
  words: Record<number, WordGloss>;
  phrases: Phrase[];
}

export interface VideoInput {
  id: string;
  segments: RawSegment[];
}

export class GeminiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Set when every key and model is resting: the earliest time one of them works again. */
    readonly retryAt?: number,
  ) {
    super(message);
  }
}

/**
 * All keys, the main one first. Spare keys take over when a key has used up its free limits:
 * GEMINI_API_KEY is the main key, GEMINI_API_KEYS is a comma separated list of more.
 */
export function geminiKeys(): string[] {
  const raw = [process.env.GEMINI_API_KEY ?? "", ...(process.env.GEMINI_API_KEYS ?? "").split(/[\s,;]+/)];
  return [...new Set(raw.map((k) => k.trim()).filter((k) => k.length > 15))];
}

export function hasGeminiKey(): boolean {
  return geminiKeys().length > 0;
}

const pairId = (key: string, model: string) => `${key.slice(-6)}|${model}`;

function parseError(raw: string): { message: string; retryMs: number | null; daily: boolean } {
  try {
    const error = JSON.parse(raw)?.error;
    const details: { retryDelay?: unknown; violations?: { quotaId?: string }[] }[] = error?.details ?? [];
    const retry = details.find((d) => typeof d?.retryDelay === "string");
    const daily = details.some((d) => (d.violations ?? []).some((v) => /PerDay/i.test(v.quotaId ?? "")));
    return {
      message: String(error?.message ?? raw).slice(0, 300),
      retryMs: retry ? parseFloat(String(retry.retryDelay)) * 1000 : null,
      daily,
    };
  } catch {
    return { message: raw.slice(0, 300), retryMs: null, daily: false };
  }
}

const isWord = (form: string) => /\p{L}/u.test(form);
const formOf = (bare: string) => bare.toLowerCase();

/** The distinct words of a video that still need a translation, in order of first appearance. */
function wordsToGloss(segments: RawSegment[], known: Map<string, WordGloss>): string[] {
  const forms = new Set<string>();
  for (const segment of segments) {
    for (const token of segment.tokens) {
      const form = formOf(token.w);
      if (isWord(form) && !known.has(form)) forms.add(form);
    }
  }
  return [...forms];
}

/** Words of a video that were translated in earlier videos, shown to the model so it can correct them in context. */
function knownInVideo(segments: RawSegment[], known: Map<string, WordGloss>): string[] {
  const forms = new Set<string>();
  for (const segment of segments) {
    for (const token of segment.tokens) {
      const form = formOf(token.w);
      if (known.has(form)) forms.add(form);
    }
  }
  return [...forms].map((form) => `${form}=${known.get(form)!.az}`);
}

function buildPrompt(videos: VideoInput[], language: string, known: Map<string, WordGloss>): string {
  const blocks = videos.map((video, n) => {
    const lines = video.segments.map(
      (segment, i) => `S${i}: ${segment.tokens.map((t, k) => `${k}:${t.t}`).join(" ")}`,
    );
    const already = knownInVideo(video.segments, known);
    return [
      `VIDEO ${n}`,
      `Words: ${wordsToGloss(video.segments, known).join(", ")}`,
      ...(already.length ? [`Known: ${already.join("; ")}`] : []),
      ...lines,
    ].join("\n");
  });

  return `You are the dictionary engine of an app that teaches ${language} to Azerbaijani speakers.
Below are the ${language} subtitles of ${videos.length} short video(s). Every video has numbered segments, and every segment is a list of numbered tokens written as index:token.
The subtitles may come from automatic speech recognition, so a word can be misspelled or misheard: work with what was most likely said.

Return one object per video in "v":
- "n": the video number.
- "g": the glossary. One object for every word in the "Words" list of that video, each word exactly once:
  "f" the word exactly as listed, "l" its ${language} dictionary form in lowercase, "p" part of speech (noun, verb, adj, adv, prep, pron, det, conj, aux, num, interj or part), "c" its CEFR level for a learner of ${language} (A1, A2, B1, B2, C1 or C2), "a" its Azerbaijani meaning for the sense used in this video, written in dictionary form (verbs as infinitive, nouns in singular) so it fits every sentence the word appears in: one to three words, not a definition.
  If a word has no direct Azerbaijani equivalent (auxiliary verbs, articles, particles), write a very short Azerbaijani grammar note such as "köməkçi feil" or "artikl". Never write a dash and never leave it empty.
- "s": one object for every segment of the video:
  "i" the segment number. "tr" a natural Azerbaijani translation of the whole segment (standard Azerbaijani, Latin script).
  "p" the multi-word units a learner should study as ONE item, an empty list when there are none: "f" index of the first token, "t" index of the last token, "k" kind (collocation, idiom, phrasal verb or expression), "c" CEFR level, "l" base form of the unit in ${language}, "e" a short meaning in simple English, "a" the Azerbaijani meaning in this context.
  Use only contiguous tokens (2 to 6), no overlapping units, at most 3 per segment, and only when the meaning is not obvious from the separate words. In English such units would be "make a decision", "talk someone down", "break the ice" and "as well as": find the same kinds of units in ${language}.
  "x" corrections, usually an empty list: only for a token whose meaning in THIS sentence differs from its meaning in the glossary or in the "Known" list: "i" token index, "a" the Azerbaijani meaning here.

Words in the "Known" list already have the translation shown after the equals sign. Do not repeat them in the glossary.

${blocks.join("\n\n")}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function requestBody(prompt: string, model: string): string {
  const thinking = THINKING_LEVEL !== "off" && !withoutThinking.has(model);
  return JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 32768,
      ...(!withoutSchema.has(model) && { responseJsonSchema: RESPONSE_SCHEMA }),
      ...(thinking && { thinkingConfig: { thinkingLevel: THINKING_LEVEL } }),
    },
  });
}

/**
 * Sends one prompt, walking the keys and for each key the models, like LangVis does.
 * A pair that is out of quota, busy or gone rests for a while and the next one answers.
 */
async function generate(prompt: string): Promise<{ text: string; model: string }> {
  const keys = geminiKeys();
  if (!keys.length) throw new GeminiError(401, "No Gemini API key is set");

  let lastError: GeminiError | null = null;

  for (const key of keys) {
    for (const model of MODELS) {
      const id = pairId(key, model);
      if ((resting.get(id) ?? 0) > Date.now()) continue;

      let waited = false;
      for (;;) {
        const sentThinking = THINKING_LEVEL !== "off" && !withoutThinking.has(model);
        const sentSchema = !withoutSchema.has(model);

        let res: Response;
        try {
          res = await fetch(`${API_ROOT}/models/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: requestBody(prompt, model),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
        } catch (err) {
          // Timeout or network trouble: let this pair rest and move on.
          lastError = new GeminiError(503, err instanceof Error ? err.message : String(err));
          resting.set(id, Date.now() + REST_BUSY_MS);
          break;
        }

        if (res.ok) {
          const data = await res.json();
          const answer: string = (data?.candidates?.[0]?.content?.parts ?? [])
            .filter((p: { thought?: boolean }) => !p.thought)
            .map((p: { text?: string }) => p.text ?? "")
            .join("");
          if (answer.trim()) return { text: answer, model };
          throw new Error(`Gemini returned no text (finishReason ${data?.candidates?.[0]?.finishReason})`);
        }

        const { message, retryMs, daily } = parseError(await res.text());

        // Older or newer model families may not know an option: drop it and ask again.
        if (res.status === 400 && sentThinking && /thinking/i.test(message)) {
          withoutThinking.add(model);
          continue;
        }
        if (res.status === 400 && sentSchema && /schema/i.test(message)) {
          withoutSchema.add(model);
          continue;
        }

        lastError = new GeminiError(res.status, message);

        const badKey =
          res.status === 401 || res.status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(message);
        if (badKey) {
          // This key is no good: every model of it rests and the next key is tried.
          for (const m of MODELS) resting.set(pairId(key, m), Date.now() + REST_BAD_KEY_MS);
          break;
        }

        if (res.status === 429) {
          if (!daily && !waited && retryMs !== null && retryMs <= MAX_INLINE_WAIT_MS) {
            waited = true;
            await sleep(retryMs + 500);
            continue;
          }
          resting.set(id, Date.now() + (daily ? REST_DAILY_LIMIT_MS : (retryMs ?? REST_BUSY_MS) + 1000));
          break;
        }
        if (res.status === 404) {
          resting.set(id, Date.now() + REST_GONE_MS);
          break;
        }
        if (res.status >= 500) {
          resting.set(id, Date.now() + REST_BUSY_MS);
          break;
        }

        // Anything else is not the model's fault (a bad request): stop here.
        throw lastError;
      }
    }
  }

  const waits = keys.flatMap((key) => MODELS.map((model) => resting.get(pairId(key, model)) ?? 0));
  if (waits.length && waits.every((t) => t > Date.now())) {
    throw new GeminiError(429, lastError?.message ?? "Every Gemini model is resting", Math.min(...waits));
  }
  throw lastError ?? new GeminiError(500, "No Gemini model is configured");
}

function asLevel(value: unknown): Level {
  const v = String(value ?? "").toUpperCase();
  return (LEVELS as string[]).includes(v) ? (v as Level) : "B1";
}

function asText(value: unknown, max = 160): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const hasLetters = (value: string) => /\p{L}/u.test(value);
const asRecords = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : [];

/** Turns the model's answer for one video into per-segment analysis, or null when it is incomplete. */
function parseVideo(
  entry: Record<string, unknown> | undefined,
  video: VideoInput,
  known: Map<string, WordGloss>,
): SegmentAnalysis[] | null {
  if (!entry) return null;

  const glossary = new Map<string, WordGloss>();
  for (const g of asRecords(entry.g)) {
    const form = formOf(asText(g.f, 40));
    const meaning = asText(g.a, 60);
    if (!form || !hasLetters(meaning)) continue;
    glossary.set(form, {
      lemma: asText(g.l, 40).toLowerCase() || form,
      pos: asText(g.p, 10).toLowerCase(),
      lvl: asLevel(g.c),
      az: meaning,
    });
  }

  const wanted = wordsToGloss(video.segments, known);
  const covered = wanted.filter((form) => glossary.has(form)).length;
  if (wanted.length && covered / wanted.length < 0.6) return null;

  const byIndex = new Map<number, Record<string, unknown>>();
  for (const s of asRecords(entry.s)) {
    if (typeof s.i === "number") byIndex.set(s.i, s);
  }

  const result: SegmentAnalysis[] = [];
  for (let i = 0; i < video.segments.length; i++) {
    const segment = video.segments[i];
    const answer = byIndex.get(i);
    const tr = asText(answer?.tr, 400);
    if (!answer || !tr) return null;

    const count = segment.tokens.length;
    const corrections = new Map<number, string>();
    for (const x of asRecords(answer.x)) {
      const meaning = asText(x.a, 60);
      if (Number.isInteger(x.i) && hasLetters(meaning)) corrections.set(x.i as number, meaning);
    }

    const words: Record<number, WordGloss> = {};
    segment.tokens.forEach((token, k) => {
      const form = formOf(token.w);
      const base = glossary.get(form) ?? known.get(form);
      const corrected = corrections.get(k);
      if (base) words[k] = corrected ? { ...base, az: corrected } : base;
      else if (corrected) words[k] = { lemma: form, pos: "", lvl: "B1", az: corrected };
    });

    const phrases: Phrase[] = [];
    const taken = new Set<number>();
    for (const p of asRecords(answer.p)) {
      const from = p.f as number;
      const to = p.t as number;
      if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
      if (from < 0 || to >= count || to - from < 1 || to - from > 5) continue;
      const range = Array.from({ length: to - from + 1 }, (_, k) => from + k);
      if (range.some((k) => taken.has(k))) continue;
      const meaning = asText(p.a, 80);
      if (!hasLetters(meaning)) continue;
      range.forEach((k) => taken.add(k));
      const kind = asText(p.k, 20).toLowerCase() as PhraseKind;
      phrases.push({
        from,
        to,
        kind: KINDS.includes(kind) ? kind : "expression",
        lvl: asLevel(p.c),
        lemma:
          asText(p.l, 60).toLowerCase() ||
          segment.tokens
            .slice(from, to + 1)
            .map((t) => t.w.toLowerCase())
            .join(" "),
        en: asText(p.e, 100),
        az: meaning,
      });
    }
    phrases.sort((a, b) => a.from - b.from);

    result.push({ tr, words, phrases });
  }
  return result;
}

/**
 * Analyses several videos in ONE request. Requests are what the free tier counts, so packing
 * videos together is what makes the daily limit go far. Every distinct word is translated once
 * per video, and words already translated in earlier videos (`known`) are not asked again.
 * Videos whose answer came back incomplete are simply missing from the result.
 */
export async function analyzeVideos(
  videos: VideoInput[],
  language: string,
  known: Map<string, WordGloss>,
): Promise<{ analysis: Map<string, SegmentAnalysis[]>; model: string }> {
  const prompt = buildPrompt(videos, language, known);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reply = await generate(prompt);
      const json = JSON.parse(reply.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      const entries = new Map<number, Record<string, unknown>>();
      for (const entry of asRecords(json?.v)) {
        if (typeof entry.n === "number") entries.set(entry.n, entry);
      }

      const analysis = new Map<string, SegmentAnalysis[]>();
      videos.forEach((video, n) => {
        const parsed = parseVideo(entries.get(n), video, known);
        if (parsed) analysis.set(video.id, parsed);
      });
      // An answer with nothing usable is worth one more try, a partly usable one is kept.
      if (analysis.size) return { analysis, model: reply.model };
      lastError = new Error("Gemini answer had no complete video");
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini output was invalid");
}

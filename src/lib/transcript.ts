const PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const CLIENT_VERSION = "20.10.38";
const USER_AGENT = `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14)`;

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  cues: Cue[];
  /** "manual" = uploaded by the creator, "auto" = YouTube speech recognition. */
  kind: "manual" | "auto";
}

/** The video has no usable captions in the language (permanent, never worth a retry). */
export class NoTranscriptError extends Error {}

/** The video has no captions of any kind, so there is nothing to tell what language it is in. */
export class NoCaptionsError extends NoTranscriptError {}

/**
 * YouTube refused to answer this server, usually "Sign in to confirm you're not a bot", which it shows
 * to data-centre addresses such as Cloud Run. Says nothing about the video, so it must not be recorded.
 */
export class TranscriptBlockedError extends Error {}

const TIMEOUT_MS = 20_000;

interface Track {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
}

interface Json3 {
  events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function fromJson3(json: Json3): Cue[] {
  const cues: Cue[] = [];
  for (const event of json.events ?? []) {
    if (!event.segs) continue;
    const text = event.segs.map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = (event.tStartMs ?? 0) / 1000;
    cues.push({ start, end: start + (event.dDurationMs ?? 0) / 1000, text });
  }
  return cues;
}

function fromXml(xml: string): Cue[] {
  const cues: Cue[] = [];
  for (const m of xml.matchAll(/<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = decodeEntities(m[3].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = Number(m[1]) / 1000;
    cues.push({ start, end: start + Number(m[2]) / 1000, text });
  }
  if (cues.length) return cues;

  for (const m of xml.matchAll(/<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g)) {
    const text = decodeEntities(m[3]).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = parseFloat(m[1]);
    cues.push({ start, end: start + parseFloat(m[2]), text });
  }
  return cues;
}

/**
 * The caption tracks of a video, through YouTube's Android player endpoint.
 * This is not an official API: it can break or be rate limited at any time.
 */
async function fetchTracks(videoId: string): Promise<Track[]> {
  const res = await fetch(PLAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: CLIENT_VERSION } },
      videoId,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 429 || res.status === 403) throw new TranscriptBlockedError(`player endpoint responded ${res.status}`);
  if (!res.ok) throw new Error(`player endpoint responded ${res.status}`);

  const data = await res.json();
  const status: string | undefined = data?.playabilityStatus?.status;
  // LOGIN_REQUIRED is the bot check (or, rarely, an age limit): not a fact about the captions.
  if (status === "LOGIN_REQUIRED") {
    throw new TranscriptBlockedError(`YouTube asked to sign in: ${data?.playabilityStatus?.reason ?? "bot check"}`);
  }
  if (status && status !== "OK") throw new NoTranscriptError(`video is ${status}`);

  return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

const inLanguage = (track: Track, lang: string) => track.languageCode?.toLowerCase().startsWith(lang) ?? false;
const available = (tracks: Track[]) => tracks.map((t) => t.languageCode).join(", ") || "none";

/** Downloads the captions in one language: the track made by hand when there is one, else the automatic one. */
async function readTrack(tracks: Track[], lang: string): Promise<Transcript> {
  const matching = tracks.filter((t) => inLanguage(t, lang));
  const track = matching.find((t) => t.kind !== "asr") ?? matching[0];
  if (!track) throw new NoTranscriptError(`no "${lang}" caption track (available: ${available(tracks)})`);

  const url = new URL(track.baseUrl);
  if (!url.hostname.endsWith(".youtube.com")) throw new NoTranscriptError("unexpected caption host");

  const kind = track.kind === "asr" ? "auto" : "manual";

  url.searchParams.set("fmt", "json3");
  const jsonRes = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (jsonRes.ok) {
    const body = await jsonRes.text();
    try {
      const cues = fromJson3(JSON.parse(body));
      if (cues.length) return { cues, kind };
    } catch {}
  }

  url.searchParams.delete("fmt");
  const xmlRes = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!xmlRes.ok) throw new Error(`caption track responded ${xmlRes.status}`);
  const cues = fromXml(await xmlRes.text());
  if (!cues.length) throw new NoTranscriptError("caption track is empty");
  return { cues, kind };
}

/**
 * What caption tracks a video has, without reading them: their language, and whether YouTube made
 * them by speech recognition. Throws like the reading does when YouTube will not say.
 */
export async function captionTracks(videoId: string): Promise<{ lang: string; auto: boolean }[]> {
  return (await fetchTracks(videoId)).map((t) => ({ lang: t.languageCode?.toLowerCase() ?? "", auto: t.kind === "asr" }));
}

/** Reads the captions of a video in the given language (ISO code such as "en" or "sk"). */
export async function fetchTranscript(videoId: string, lang: string): Promise<Transcript> {
  return readTrack(await fetchTracks(videoId), lang);
}

/**
 * Reads the captions of a video whose language is not known, and says which of `langs` it is in.
 * The automatic track is always in the language that is spoken, so it decides: subtitles made by
 * hand may be a translation. A video without an automatic track counts as the first of `langs`
 * that has captions.
 */
export async function fetchSpokenTranscript(videoId: string, langs: string[]): Promise<Transcript & { lang: string }> {
  const tracks = await fetchTracks(videoId);
  if (!tracks.length) throw new NoCaptionsError("the video has no captions");
  const spoken = tracks.find((t) => t.kind === "asr");
  const lang = (spoken ? langs.filter((l) => inLanguage(spoken, l)) : langs).find((l) =>
    tracks.some((t) => inLanguage(t, l)),
  );
  if (!lang) {
    throw new NoTranscriptError(
      spoken ? `the video is in "${spoken.languageCode}"` : `no caption track in ${langs.join(" or ")} (available: ${available(tracks)})`,
    );
  }
  return { ...(await readTrack(tracks, lang)), lang };
}

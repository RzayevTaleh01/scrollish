import { videoById, type VideoRow } from "./db";
import { REQUEST_MAX_SECONDS, unavailableReason } from "./ingest";
import { LANGUAGES, languageOf, type LanguageId } from "./languages";
import { captionTracks, NoTranscriptError } from "./transcript";
import type { CheckStep, VideoCheck } from "./types";
import { fetchVideo, type FoundVideo } from "./youtube";

const ok = (detail: string): CheckStep => ({ state: "ok", detail });
const fail = (detail: string): CheckStep => ({ state: "fail", detail });
const unknown = (detail: string): CheckStep => ({ state: "unknown", detail });

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
/** "de" or "de-AT" as "German". */
function languageName(code: string): string {
  try {
    return displayNames.of(code.split("-")[0]) ?? code;
  } catch {
    return code;
  }
}

/** The language Scrollish teaches that a code belongs to ("en-US" is English), or null. */
const taught = (code: string | null | undefined): LanguageId | null =>
  LANGUAGES.find((l) => code?.toLowerCase().startsWith(l.id))?.id ?? null;

const TAUGHT_NAMES = LANGUAGES.map((l) => l.label).join(" or ");

/** The language as its uploader gave it, when YouTube will not tell this server about the captions. */
function statedLanguage(found: FoundVideo | null | undefined): CheckStep {
  const code = found?.audioLanguage;
  if (!code) return unknown("Found out while it is prepared");
  const lang = taught(code);
  return lang ? ok(languageOf(lang).label) : fail(`${languageName(code)}, not taught here`);
}

/** The checks for a video tried before that will never be ready, matched to the one it failed. */
function fromEarlierTry(row: VideoRow, reason: string, steps: Pick<VideoCheck, "video" | "language" | "subtitles">) {
  if (row.status === "no_captions" || row.status === "too_short") return { ...steps, subtitles: fail(reason) };
  return { ...steps, video: fail(reason) };
}

/**
 * Checks a video opened by its link before the viewer is sent on to it: that YouTube has it and lets
 * it play here, that it is short enough, that it is spoken in a language Scrollish teaches, and that
 * it has subtitles. YouTube often refuses this server the captions; what that leaves open is
 * "unknown", which does not stop the video: it is found out while the video is prepared.
 */
export async function checkVideo(id: string): Promise<VideoCheck> {
  const row = await videoById(id).catch(() => null);
  if (row?.status === "ready") {
    return {
      ok: true,
      ready: true,
      title: row.video.title,
      channelTitle: row.video.channelTitle,
      video: ok(`On YouTube, ${clock(row.video.duration)}`),
      language: ok(languageOf(row.lang as LanguageId).label),
      subtitles: ok("Ready, prepared before"),
      reason: null,
    };
  }

  // Undefined: YouTube could not be asked (no key, or it did not answer). Null: it does not know the video.
  const found = await fetchVideo(id).catch(() => undefined);
  const title = found?.title ?? row?.video.title ?? "";
  const channelTitle = found?.channelTitle ?? row?.video.channelTitle ?? "";

  let video: CheckStep;
  if (found === null) video = fail("YouTube does not know this video");
  else if (found === undefined) video = unknown("YouTube could not be asked");
  else if (!found.playable) video = fail("It cannot be played outside YouTube");
  else if (found.duration > REQUEST_MAX_SECONDS) video = fail(`It is ${clock(found.duration)} long, the limit is 3:00`);
  else video = ok(`On YouTube, ${clock(found.duration)}`);

  let language: CheckStep;
  let subtitles: CheckStep;
  if (video.state === "fail") {
    language = unknown("Not checked");
    subtitles = unknown("Not checked");
  } else {
    let tracks: { lang: string; auto: boolean }[] | null;
    try {
      tracks = await captionTracks(id);
    } catch (err) {
      // The video is not playable. Otherwise YouTube refused this server (its bot check) or did not
      // answer, and nothing is known about the captions.
      if (err instanceof NoTranscriptError) video = fail("It cannot be played outside YouTube");
      tracks = null;
    }

    if (!tracks) {
      language = statedLanguage(found);
      subtitles = unknown("Read while it is prepared");
    } else if (!tracks.length) {
      language = statedLanguage(found);
      subtitles = fail("This video has no subtitles");
    } else {
      // The automatic track is in the language spoken; subtitles made by hand may be a translation.
      const spoken = tracks.find((t) => t.auto)?.lang ?? null;
      const lang = spoken ? taught(spoken) : (LANGUAGES.find((l) => tracks.some((t) => taught(t.lang) === l.id))?.id ?? null);
      if (lang) {
        const name = languageOf(lang).label;
        const byHand = tracks.some((t) => !t.auto && taught(t.lang) === lang);
        language = ok(name);
        subtitles = ok(byHand ? `${name}, by the creator` : `${name}, automatic`);
      } else {
        language = spoken ? fail(`${languageName(spoken)}, not taught here`) : statedLanguage(found);
        subtitles = fail(`None in ${TAUGHT_NAMES}`);
      }
    }
  }

  let steps = { video, language, subtitles };
  // Tried before and it will never be ready: what was found out then stands, whatever YouTube says now.
  const earlier = row && unavailableReason(row);
  if (row && earlier && ![video, language, subtitles].some((s) => s.state === "fail")) steps = fromEarlierTry(row, earlier, steps);

  const failed = [steps.video, steps.language, steps.subtitles].find((s) => s.state === "fail");
  return { ok: !failed, ready: false, title, channelTitle, ...steps, reason: failed?.detail ?? null };
}

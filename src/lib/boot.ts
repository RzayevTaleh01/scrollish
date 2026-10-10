import { DEFAULT_LANGUAGE, LANGUAGES } from "./languages";
import { LEVELS } from "./types";

/** Videos per feed request. */
export const FEED_PAGE_SIZE = 8;
export const SETTINGS_KEY = "socialearn:settings";

/** The first page of the feed, asked for by the script below before the app itself was running. */
interface EarlyFeed {
  seed: number;
  url: string;
  response: Promise<Response>;
}

declare global {
  interface Window {
    __scrollishFeed?: EarlyFeed;
  }
}

/**
 * Runs in <head>, while the app's own JavaScript is still being downloaded: it asks for the first
 * page of the feed straight away, so the videos are known about a second sooner. It has to build
 * exactly the address the feed builds for its first request (same order of parameters), or the
 * answer is thrown away and asked for again.
 */
export const BOOT_SCRIPT = `(function () {
  try {
    var languages = ${JSON.stringify(LANGUAGES.map((l) => l.id))};
    var levels = ${JSON.stringify(LEVELS)};
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)}) || "{}") || {};
    } catch (e) {}
    var link = /^\\/shorts\\/([\\w-]{11})\\/?$/.exec(location.pathname);
    var shared = link ? link[1] : null;
    var language = languages.indexOf(saved.language) >= 0 ? saved.language : ${JSON.stringify(DEFAULT_LANGUAGE)};
    var seed = Math.floor(Math.random() * 1e9);
    var params = new URLSearchParams({
      lang: language,
      topic: "all",
      seed: String(seed),
      offset: "0",
      limit: "${FEED_PAGE_SIZE}",
    });
    if (levels.indexOf(saved.level) >= 0) params.set("level", saved.level);
    if (shared) params.set("first", shared);
    var url = "/api/feed?" + params;
    window.__scrollishFeed = { seed: seed, url: url, response: fetch(url) };
  } catch (e) {}
})();`;

/** The address of a video here: YouTube's own, with this site in place of youtube.com. */
export const videoPath = (id: string) => `/shorts/${id}`;

/** The video the address bar points at, if any. */
export function linkedVideo(): string | null {
  return /^\/shorts\/([\w-]{11})\/?$/.exec(window.location.pathname)?.[1] ?? null;
}

/** The seed the early request used, so the feed asks for the same shuffle. */
export function earlySeed(): number | null {
  return window.__scrollishFeed?.seed ?? null;
}

/** The early answer for this address, if that is what was asked for. It can be used once. */
export function takeEarlyFeed(url: string): Promise<Response> | null {
  const early = window.__scrollishFeed;
  window.__scrollishFeed = undefined;
  // Should the early request have failed, the feed simply asks again.
  return early?.url === url ? early.response.catch(() => fetch(url)) : null;
}

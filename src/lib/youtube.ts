import { CHANNELS } from "./channels";
import type { Short } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
const POOL_TTL_MS = 6 * 60 * 60 * 1000;
const PER_CHANNEL = 30;
const MIN_SECONDS = 5;
const MAX_SECONDS = 180;

interface ChannelsRes {
  items?: {
    id: string;
    snippet: {
      title: string;
      thumbnails: { default?: { url: string }; medium?: { url: string } };
    };
  }[];
}

interface PlaylistRes {
  items?: { contentDetails: { videoId: string } }[];
}

interface VideosRes {
  items?: {
    id: string;
    snippet: {
      title: string;
      channelId: string;
      channelTitle: string;
      defaultAudioLanguage?: string;
      defaultLanguage?: string;
    };
    contentDetails: { duration: string; caption?: string };
    status: { embeddable: boolean; privacyStatus: string };
  }[];
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");

  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key })) url.searchParams.set(k, v);

  // A hung request would otherwise keep the ingest worker busy forever.
  const res = await fetch(url, { next: { revalidate: POOL_TTL_MS / 1000 }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`YouTube ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

function toSeconds(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

async function buildPool(): Promise<Short[]> {
  // The API accepts at most 50 channel ids per request.
  const meta = new Map<string, { title: string; avatar: string }>();
  for (let i = 0; i < CHANNELS.length; i += 50) {
    const channelRes = await yt<ChannelsRes>("channels", {
      part: "snippet",
      id: CHANNELS.slice(i, i + 50)
        .map((c) => c.id)
        .join(","),
      maxResults: "50",
    });
    for (const c of channelRes.items ?? []) {
      meta.set(c.id, {
        title: c.snippet.title,
        avatar: (c.snippet.thumbnails.medium ?? c.snippet.thumbnails.default)?.url ?? "",
      });
    }
  }

  // Every channel has a hidden Shorts-only playlist: swap "UC" for "UUSH" in the channel id.
  const found = await Promise.all(
    CHANNELS.map(async (channel) => {
      try {
        const res = await yt<PlaylistRes>("playlistItems", {
          part: "contentDetails",
          maxResults: String(PER_CHANNEL),
          playlistId: `UUSH${channel.id.slice(2)}`,
        });
        return (res.items ?? []).map((i) => ({ videoId: i.contentDetails.videoId, channel }));
      } catch {
        return [];
      }
    }),
  );

  const owner = new Map(found.flat().map((f) => [f.videoId, f.channel]));
  const ids = [...owner.keys()];
  const pool: Short[] = [];

  for (let i = 0; i < ids.length; i += 50) {
    const res = await yt<VideosRes>("videos", {
      part: "snippet,contentDetails,status",
      id: ids.slice(i, i + 50).join(","),
    });
    for (const v of res.items ?? []) {
      const channel = owner.get(v.id);
      const seconds = toSeconds(v.contentDetails.duration);
      if (!channel) continue;
      if (!v.status.embeddable || v.status.privacyStatus !== "public") continue;
      if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) continue;

      // The language declared by creators is unreliable (many leave it on English),
      // so the caption track decides later whether the video is really in this language.
      const info = meta.get(channel.id);
      pool.push({
        id: v.id,
        lang: channel.lang,
        title: v.snippet.title,
        channelId: channel.id,
        channelTitle: info?.title ?? channel.name,
        avatar: info?.avatar ?? "",
        topics: channel.topics,
        duration: seconds,
        captions: v.contentDetails.caption === "true",
      });
    }
  }

  return pool;
}

/** A video as YouTube describes it, before its language is known. */
export type FoundVideo = Omit<Short, "lang" | "topics"> & {
  /** Public and allowed to play inside other sites. */
  playable: boolean;
  /** The language its uploader says it is spoken in ("en", "en-US"...), when they said. */
  audioLanguage: string | null;
};

/** One video by its id, for a link to a video that is not in the pool. Null when YouTube does not know it. */
export async function fetchVideo(id: string): Promise<FoundVideo | null> {
  const res = await yt<VideosRes>("videos", { part: "snippet,contentDetails,status", id });
  const video = res.items?.[0];
  if (!video) return null;

  const channel = await yt<ChannelsRes>("channels", { part: "snippet", id: video.snippet.channelId });
  const thumbnails = channel.items?.[0]?.snippet.thumbnails;
  return {
    id,
    title: video.snippet.title,
    channelId: video.snippet.channelId,
    channelTitle: video.snippet.channelTitle,
    avatar: (thumbnails?.medium ?? thumbnails?.default)?.url ?? "",
    duration: toSeconds(video.contentDetails.duration),
    captions: video.contentDetails.caption === "true",
    playable: video.status.embeddable && video.status.privacyStatus === "public",
    audioLanguage: video.snippet.defaultAudioLanguage ?? video.snippet.defaultLanguage ?? null,
  };
}

// The cache key carries the channel count, so adding channels rebuilds the pool right away.
const g = globalThis as unknown as {
  __shortsPool?: { at: number; pool: Short[]; channels: number };
  __shortsPending?: Promise<Short[]>;
};

export async function getPool(): Promise<Short[]> {
  const cached = g.__shortsPool;
  const fresh = cached && cached.channels === CHANNELS.length && Date.now() - cached.at < POOL_TTL_MS;
  if (fresh) return cached.pool;

  g.__shortsPending ??= buildPool()
    .then((pool) => {
      if (pool.length) g.__shortsPool = { at: Date.now(), pool, channels: CHANNELS.length };
      return pool;
    })
    .catch((err) => {
      if (cached) return cached.pool;
      throw err;
    })
    .finally(() => {
      g.__shortsPending = undefined;
    });

  return g.__shortsPending;
}

import type { FeedItem, Level } from "./types";

/** A liked video. There are no accounts yet, so the list lives in this browser's localStorage. */
export interface LikedVideo {
  id: string;
  /** Language of the video, null for likes saved before this was recorded. */
  lang: string | null;
  title: string;
  channelTitle: string;
  avatar: string;
  level: Level | null;
  likedAt: number;
}

const STORAGE_KEY = "socialearn:liked";

export function likedFrom(item: FeedItem, lang: string): LikedVideo {
  return {
    id: item.id,
    lang,
    title: item.title,
    channelTitle: item.channelTitle,
    avatar: item.avatar,
    level: item.level,
    likedAt: Date.now(),
  };
}

/** Reads the list. Likes used to be stored as bare video ids: those are kept with what is known. */
export function readLiked(): LikedVideo[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((entry): LikedVideo[] => {
      if (typeof entry === "string") {
        return /^[\w-]{11}$/.test(entry)
          ? [{ id: entry, lang: null, title: "", channelTitle: "", avatar: "", level: null, likedAt: 0 }]
          : [];
      }
      return entry && typeof entry.id === "string" ? [entry as LikedVideo] : [];
    });
  } catch {
    return [];
  }
}

export function writeLiked(list: LikedVideo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

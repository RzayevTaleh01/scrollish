import { LEVELS, type Level } from "./types";

interface Channeled {
  id: string;
  channelId: string;
}

const MIN_LEVEL_MATCHES = 6;

/**
 * Keeps the videos at the viewer's level. When there are too few of them the range widens
 * one level at a time, and with almost nothing analysed yet every video is shown.
 */
export function filterByLevel<T extends { level: Level | null }>(pool: T[], level: Level | null): T[] {
  if (!level) return pool;
  const target = LEVELS.indexOf(level);

  for (const reach of [0, 1, 2]) {
    const matches = pool.filter((v) => v.level && Math.abs(LEVELS.indexOf(v.level) - target) <= reach);
    if (matches.length >= MIN_LEVEL_MATCHES) return matches;
  }
  return pool;
}

/**
 * How far a video is from the viewer's level: 0 for the level itself, then the nearest levels,
 * the easier one before the harder one. The feed plays the closest videos first.
 */
export function levelDistance(level: Level | null, target: Level): number {
  if (!level) return LEVELS.length * 2;
  const steps = LEVELS.indexOf(level) - LEVELS.indexOf(target);
  return Math.abs(steps) * 2 - (steps < 0 ? 1 : 0);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T extends Channeled>(pool: T[], seed: number, rank?: (item: T) => number): T[] {
  const rand = mulberry32(seed);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Ranked videos keep their rank order (the sort is stable, so each rank stays shuffled).
  if (rank) a.sort((x, y) => rank(x) - rank(y));
  // Avoid two clips from the same channel in a row, without moving a clip out of its rank.
  for (let i = 1; i < a.length; i++) {
    if (a[i].channelId !== a[i - 1].channelId) continue;
    const k = a.findIndex(
      (s, idx) => idx > i && s.channelId !== a[i - 1].channelId && (!rank || rank(s) === rank(a[i])),
    );
    if (k !== -1) [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

/**
 * Endless feed: every pass over the pool is reshuffled, so the loop never repeats the same order.
 * Each pass depends only on the seed and its number, so any page can be computed on its own and
 * pages always join up. A small pool simply comes round again sooner.
 * With `rank`, every pass plays the lowest ranks first.
 */
export function sliceFeed<T extends Channeled>(
  pool: T[],
  seed: number,
  offset: number,
  limit: number,
  rank?: (item: T) => number,
): (T & { index: number })[] {
  const n = pool.length;
  const orders = new Map<number, T[]>();
  const items: (T & { index: number })[] = [];
  const passSeed = (pass: number) => seed + pass * 7919;

  const orderOf = (pass: number): T[] => {
    let order = orders.get(pass);
    if (order) return order;
    order = shuffled(pool, passSeed(pass), rank);
    // A pass must not start with the video the previous pass ended on, or it plays twice in a row.
    if (pass > 0 && n > 1 && order[0].id === shuffled(pool, passSeed(pass - 1), rank)[n - 1].id) {
      // Ranked passes swap the first two, so the pass still opens with the closest videos.
      const other = rank && n > 2 ? 1 : n - 1;
      [order[0], order[other]] = [order[other], order[0]];
    }
    orders.set(pass, order);
    return order;
  };

  for (let i = offset; i < offset + limit; i++) {
    items.push({ ...orderOf(Math.floor(i / n))[i % n], index: i });
  }
  return items;
}

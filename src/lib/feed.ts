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

function shuffled<T extends Channeled>(pool: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Avoid two clips from the same channel in a row.
  for (let i = 1; i < a.length; i++) {
    if (a[i].channelId !== a[i - 1].channelId) continue;
    const k = a.findIndex((s, idx) => idx > i && s.channelId !== a[i - 1].channelId);
    if (k !== -1) [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

/**
 * Endless feed: every pass over the pool is reshuffled, so the loop never repeats the same order.
 * Each pass depends only on the seed and its number, so any page can be computed on its own and
 * pages always join up. A small pool simply comes round again sooner.
 */
export function sliceFeed<T extends Channeled>(
  pool: T[],
  seed: number,
  offset: number,
  limit: number,
): (T & { index: number })[] {
  const n = pool.length;
  const orders = new Map<number, T[]>();
  const items: (T & { index: number })[] = [];
  const passSeed = (pass: number) => seed + pass * 7919;

  const orderOf = (pass: number): T[] => {
    let order = orders.get(pass);
    if (order) return order;
    order = shuffled(pool, passSeed(pass));
    // A pass must not start with the video the previous pass ended on, or it plays twice in a row.
    if (pass > 0 && n > 1 && order[0].id === shuffled(pool, passSeed(pass - 1))[n - 1].id) {
      [order[0], order[n - 1]] = [order[n - 1], order[0]];
    }
    orders.set(pass, order);
    return order;
  };

  for (let i = offset; i < offset + limit; i++) {
    items.push({ ...orderOf(Math.floor(i / n))[i % n], index: i });
  }
  return items;
}

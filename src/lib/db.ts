import { Pool } from "pg";
import type { DictEntry, FeedItem, Level, Segment, Short, VideoContent } from "./types";

/**
 * "deferred": the captions were read and the level estimated, but the video was not analysed
 * because the feed did not need that level at the time. `level` holds the estimate.
 * "rejected": opened by its link, but not a video the app can show. `error` says why, in words
 * meant for the viewer.
 */
export type VideoStatus = "ready" | "no_captions" | "too_short" | "failed" | "deferred" | "rejected";

export interface StatusRow {
  status: VideoStatus;
  level: Level | null;
  attempts: number;
  updatedAt: number;
}

/**
 * Postgres (Neon). Times are milliseconds since 1970 in BIGINT, JSON columns are JSONB.
 * node-postgres returns BIGINT as a string, hence the Number() calls when reading.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    lang TEXT NOT NULL DEFAULT 'en',
    title TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_title TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    topics JSONB NOT NULL,
    duration INTEGER NOT NULL,
    captions BOOLEAN NOT NULL DEFAULT FALSE,
    caption_kind TEXT,
    status TEXT NOT NULL,
    level TEXT,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS video_content (
    video_id TEXT PRIMARY KEY,
    segments JSONB NOT NULL,
    model TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dictionary (
    lang TEXT NOT NULL DEFAULT 'en',
    term TEXT NOT NULL,
    kind TEXT NOT NULL,
    pos TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL,
    az TEXT NOT NULL,
    alt JSONB NOT NULL DEFAULT '[]',
    en TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    example_tr TEXT NOT NULL DEFAULT '',
    video_id TEXT,
    uses INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (lang, term, kind)
  )`,
  `CREATE INDEX IF NOT EXISTS videos_ready ON videos (lang, status)`,
  `CREATE INDEX IF NOT EXISTS dictionary_by_use ON dictionary (lang, uses DESC)`,
];

/** Words too common to be useful dictionary entries (they stay tappable in subtitles). */
const DICTIONARY_SKIP: Record<string, Set<string>> = {
  en: new Set(
    (
      "the a an and or but of to in on at is am are was were be been being i you he she it we they me him her us them " +
      "my your his its our their this that these those do does did have has had will would can could shall should may might must not no so if as for with by from"
    ).split(" "),
  ),
  sk: new Set(
    (
      "a i aj v vo na s so z zo do od po pre pri k ku o u je som si sme ste sú bol bola bolo boli byť to ten tá tie že sa by " +
      "ako ale alebo nie áno čo kto ja ty on ona ono my vy oni ma mi ťa ti ho mu ju jej nás vás ich im môj tvoj jeho náš váš"
    ).split(" "),
  ),
};

const globalForDb = globalThis as unknown as { __scrollishPg?: Promise<Pool> };

export function getDb(): Promise<Pool> {
  globalForDb.__scrollishPg ??= init().catch((err) => {
    // Let the next call try again instead of keeping a failed connection forever.
    globalForDb.__scrollishPg = undefined;
    throw err;
  });
  return globalForDb.__scrollishPg;
}

async function init(): Promise<Pool> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
  // An idle connection the server closed must not crash the process.
  pool.on("error", (err) => console.error("[db]", err.message));
  for (const statement of SCHEMA) await pool.query(statement);
  return pool;
}

export async function videoStatuses(): Promise<Map<string, StatusRow>> {
  const db = await getDb();
  const res = await db.query("SELECT id, status, level, attempts, updated_at FROM videos");
  return new Map(
    res.rows.map((r) => [
      String(r.id),
      {
        status: String(r.status) as VideoStatus,
        level: (r.level ? String(r.level) : null) as Level | null,
        attempts: Number(r.attempts),
        updatedAt: Number(r.updated_at),
      },
    ]),
  );
}

export async function markVideo(
  short: Short,
  status: Exclude<VideoStatus, "ready">,
  error: string,
  level: Level | null = null,
) {
  const db = await getDb();
  await db.query(
    `INSERT INTO videos (id, lang, title, channel_id, channel_title, avatar, topics, duration, captions, status, error, attempts, updated_at, level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, error = EXCLUDED.error, level = EXCLUDED.level,
       attempts = videos.attempts + EXCLUDED.attempts, updated_at = EXCLUDED.updated_at`,
    [
      short.id,
      short.lang,
      short.title,
      short.channelId,
      short.channelTitle,
      short.avatar,
      JSON.stringify(short.topics),
      short.duration,
      short.captions,
      status,
      error.slice(0, 300),
      status === "failed" ? 1 : 0,
      Date.now(),
      level,
    ],
  );
}

interface DictionaryRow {
  term: string;
  kind: "word" | "phrase";
  pos: string;
  level: Level;
  az: string;
  en: string;
  example: string;
  example_tr: string;
  uses: number;
}

function dictionaryRows(segments: Segment[], lang: string): Map<string, DictionaryRow> {
  const rows = new Map<string, DictionaryRow>();
  const skip = DICTIONARY_SKIP[lang] ?? new Set<string>();

  const add = (row: DictionaryRow) => {
    const key = `${row.kind}:${row.term}`;
    const existing = rows.get(key);
    if (existing) existing.uses += 1;
    else rows.set(key, row);
  };

  for (const segment of segments) {
    const example = segment.tokens.map((t) => t.t).join(" ");
    for (const gloss of Object.values(segment.words)) {
      if (skip.has(gloss.lemma) || !/\p{L}/u.test(gloss.lemma)) continue;
      add({
        term: gloss.lemma,
        kind: "word",
        pos: gloss.pos,
        level: gloss.lvl,
        az: gloss.az,
        en: "",
        example,
        example_tr: segment.tr,
        uses: 1,
      });
    }
    for (const phrase of segment.phrases) {
      add({
        term: phrase.lemma,
        kind: "phrase",
        pos: phrase.kind,
        level: phrase.lvl,
        az: phrase.az,
        en: phrase.en,
        example,
        example_tr: segment.tr,
        uses: 1,
      });
    }
  }
  return rows;
}

export async function saveReadyVideo(
  short: Short,
  captionKind: "manual" | "auto",
  level: Level,
  segments: Segment[],
  model: string,
) {
  const db = await getDb();
  const client = await db.connect();
  const now = Date.now();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO videos (id, lang, title, channel_id, channel_title, avatar, topics, duration, captions, caption_kind, status, level, error, attempts, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready', $11, NULL, 0, $12)
       ON CONFLICT (id) DO UPDATE SET status = 'ready', lang = EXCLUDED.lang, caption_kind = EXCLUDED.caption_kind,
         level = EXCLUDED.level, error = NULL, updated_at = EXCLUDED.updated_at`,
      [
        short.id,
        short.lang,
        short.title,
        short.channelId,
        short.channelTitle,
        short.avatar,
        JSON.stringify(short.topics),
        short.duration,
        short.captions,
        captionKind,
        level,
        now,
      ],
    );
    await client.query(
      `INSERT INTO video_content (video_id, segments, model, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (video_id) DO UPDATE SET segments = EXCLUDED.segments, model = EXCLUDED.model, created_at = EXCLUDED.created_at`,
      [short.id, JSON.stringify(segments), model, now],
    );

    // Every word and phrase of the video in one statement. A meaning that differs from the stored one
    // is kept as an alternative (up to three, exact matches only).
    const rows = [...dictionaryRows(segments, short.lang).values()];
    if (rows.length) {
      await client.query(
        `INSERT INTO dictionary (lang, term, kind, pos, level, az, en, example, example_tr, video_id, uses)
         SELECT $1, r.term, r.kind, r.pos, r.level, r.az, r.en, r.example, r.example_tr, $2, r.uses
         FROM jsonb_to_recordset($3::jsonb) AS r(
           term TEXT, kind TEXT, pos TEXT, level TEXT, az TEXT, en TEXT, example TEXT, example_tr TEXT, uses INTEGER
         )
         ON CONFLICT (lang, term, kind) DO UPDATE SET
           uses = dictionary.uses + EXCLUDED.uses,
           alt = CASE
             WHEN EXCLUDED.az <> dictionary.az AND NOT dictionary.alt ? EXCLUDED.az AND jsonb_array_length(dictionary.alt) < 3
             THEN dictionary.alt || to_jsonb(EXCLUDED.az)
             ELSE dictionary.alt
           END`,
        [short.lang, short.id, JSON.stringify(rows)],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export type ReadyVideo = Omit<FeedItem, "index"> & { channelId: string };

export async function readyVideos(lang: string, topic: string): Promise<ReadyVideo[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT id, title, channel_id, channel_title, avatar, topics, duration, level
     FROM videos WHERE status = 'ready' AND lang = $1 AND ($2 = 'all' OR topics ? $2) ORDER BY id`,
    [lang, topic],
  );
  return res.rows.map(asVideo);
}

function asVideo(r: Record<string, unknown>): ReadyVideo {
  return {
    id: String(r.id),
    title: String(r.title),
    channelId: String(r.channel_id),
    channelTitle: String(r.channel_title),
    avatar: String(r.avatar),
    topics: r.topics as string[],
    duration: Number(r.duration),
    level: (r.level ? String(r.level) : null) as Level | null,
  };
}

export interface VideoRow extends StatusRow {
  lang: string;
  error: string | null;
  video: ReadyVideo;
}

/** One video and where it stands, whatever its language. For a video opened by its link. */
export async function videoById(id: string): Promise<VideoRow | null> {
  const db = await getDb();
  const res = await db.query(
    `SELECT id, lang, title, channel_id, channel_title, avatar, topics, duration, level, status, error, attempts, updated_at
     FROM videos WHERE id = $1`,
    [id],
  );
  const r = res.rows[0];
  if (!r) return null;
  const video = asVideo(r);
  return {
    status: String(r.status) as VideoStatus,
    level: video.level,
    attempts: Number(r.attempts),
    updatedAt: Number(r.updated_at),
    lang: String(r.lang),
    error: r.error ? String(r.error) : null,
    video,
  };
}

/** The analysed segments of every ready video in a language, one array per video. */
export async function segmentsByLanguage(lang: string): Promise<Segment[][]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT c.segments FROM video_content c JOIN videos v ON v.id = c.video_id
     WHERE v.status = 'ready' AND v.lang = $1`,
    [lang],
  );
  return res.rows.map((r) => r.segments as Segment[]);
}

export async function getContent(id: string): Promise<VideoContent | null> {
  const db = await getDb();
  const res = await db.query(
    `SELECT v.level, c.segments FROM videos v JOIN video_content c ON c.video_id = v.id
     WHERE v.id = $1 AND v.status = 'ready'`,
    [id],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id,
    level: (row.level ? String(row.level) : "B1") as Level,
    segments: row.segments as Segment[],
  };
}

/** `%` and `_` typed by the viewer are matched literally. */
const likeLiteral = (text: string) => text.replace(/[\\%_]/g, "\\$&");

export async function searchDictionary(opts: {
  lang: string;
  q: string;
  kind: "all" | "word" | "phrase";
  limit: number;
  offset: number;
}): Promise<{ items: DictEntry[]; total: number }> {
  const db = await getDb();
  const where: string[] = ["lang = $1"];
  const args: (string | number)[] = [opts.lang];

  if (opts.kind !== "all") {
    args.push(opts.kind);
    where.push(`kind = $${args.length}`);
  }
  if (opts.q) {
    // ILIKE folds case for every alphabet, so "ə" also finds "Ə" and "č" finds "Č".
    args.push(`${likeLiteral(opts.q)}%`, `%${likeLiteral(opts.q)}%`);
    where.push(`(term ILIKE $${args.length - 1} OR az ILIKE $${args.length})`);
  }
  const clause = `WHERE ${where.join(" AND ")}`;

  const total = await db.query(`SELECT COUNT(*) AS n FROM dictionary ${clause}`, args);
  const res = await db.query(
    `SELECT term, kind, pos, level, az, alt, en, example, example_tr, video_id, uses
     FROM dictionary ${clause} ORDER BY uses DESC, term ASC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
    [...args, opts.limit, opts.offset],
  );

  return {
    total: Number(total.rows[0]?.n ?? 0),
    items: res.rows.map((r) => ({
      term: String(r.term),
      kind: String(r.kind) as "word" | "phrase",
      pos: String(r.pos),
      level: String(r.level) as Level,
      az: String(r.az),
      alt: r.alt as string[],
      en: String(r.en),
      example: String(r.example),
      exampleTr: String(r.example_tr),
      videoId: r.video_id ? String(r.video_id) : null,
      uses: Number(r.uses),
    })),
  };
}

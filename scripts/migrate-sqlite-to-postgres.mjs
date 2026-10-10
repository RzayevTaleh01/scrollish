/**
 * Copies the old local SQLite database into Postgres (Neon), so no video has to be analysed by Gemini again.
 * Safe to run more than once: rows that already exist are left as they are.
 *
 *   node --env-file=.env.local scripts/migrate-sqlite-to-postgres.mjs [file:data/socialearn.db]
 *
 * The schema matches src/lib/db.ts; the app creates the same tables on its first connection.
 */
import { createClient } from "@libsql/client";
import pg from "pg";

const sourceUrl = process.argv[2] ?? "file:data/socialearn.db";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const source = createClient({ url: sourceUrl });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY, lang TEXT NOT NULL DEFAULT 'en', title TEXT NOT NULL, channel_id TEXT NOT NULL,
    channel_title TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '', topics JSONB NOT NULL, duration INTEGER NOT NULL,
    captions BOOLEAN NOT NULL DEFAULT FALSE, caption_kind TEXT, status TEXT NOT NULL, level TEXT, error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS video_content (
    video_id TEXT PRIMARY KEY, segments JSONB NOT NULL, model TEXT NOT NULL, created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dictionary (
    lang TEXT NOT NULL DEFAULT 'en', term TEXT NOT NULL, kind TEXT NOT NULL, pos TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL, az TEXT NOT NULL, alt JSONB NOT NULL DEFAULT '[]', en TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '', example_tr TEXT NOT NULL DEFAULT '', video_id TEXT,
    uses INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (lang, term, kind)
  )`,
  `CREATE INDEX IF NOT EXISTS videos_ready ON videos (lang, status)`,
  `CREATE INDEX IF NOT EXISTS dictionary_by_use ON dictionary (lang, uses DESC)`,
];

const all = async (sql) => (await source.execute(sql)).rows;

for (const statement of SCHEMA) await pool.query(statement);

// Videos: every status is copied, so videos without captions are not fetched again either.
const videos = (await all("SELECT * FROM videos")).map((r) => ({
  id: String(r.id),
  lang: String(r.lang),
  title: String(r.title),
  channel_id: String(r.channel_id),
  channel_title: String(r.channel_title),
  avatar: String(r.avatar ?? ""),
  topics: JSON.parse(String(r.topics)),
  duration: Number(r.duration),
  captions: Number(r.captions) === 1,
  caption_kind: r.caption_kind == null ? null : String(r.caption_kind),
  status: String(r.status),
  level: r.level == null ? null : String(r.level),
  error: r.error == null ? null : String(r.error),
  attempts: Number(r.attempts),
  updated_at: Number(r.updated_at),
}));
const videosResult = await pool.query(
  `INSERT INTO videos (id, lang, title, channel_id, channel_title, avatar, topics, duration, captions, caption_kind, status, level, error, attempts, updated_at)
   SELECT id, lang, title, channel_id, channel_title, avatar, topics, duration, captions, caption_kind, status, level, error, attempts, updated_at
   FROM jsonb_to_recordset($1::jsonb) AS r(
     id TEXT, lang TEXT, title TEXT, channel_id TEXT, channel_title TEXT, avatar TEXT, topics JSONB, duration INTEGER,
     captions BOOLEAN, caption_kind TEXT, status TEXT, level TEXT, error TEXT, attempts INTEGER, updated_at BIGINT
   )
   ON CONFLICT (id) DO NOTHING`,
  [JSON.stringify(videos)],
);

// Content is large, so it goes one video at a time.
let contentCopied = 0;
for (const r of await all("SELECT video_id, segments, model, created_at FROM video_content")) {
  const res = await pool.query(
    `INSERT INTO video_content (video_id, segments, model, created_at) VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (video_id) DO NOTHING`,
    [String(r.video_id), String(r.segments), String(r.model), Number(r.created_at)],
  );
  contentCopied += res.rowCount ?? 0;
}

const dictionary = (await all("SELECT * FROM dictionary")).map((r) => ({
  lang: String(r.lang),
  term: String(r.term),
  kind: String(r.kind),
  pos: String(r.pos),
  level: String(r.level),
  az: String(r.az),
  alt: JSON.parse(String(r.alt ?? "[]")),
  en: String(r.en ?? ""),
  example: String(r.example ?? ""),
  example_tr: String(r.example_tr ?? ""),
  video_id: r.video_id == null ? null : String(r.video_id),
  uses: Number(r.uses),
}));
const dictionaryResult = await pool.query(
  `INSERT INTO dictionary (lang, term, kind, pos, level, az, alt, en, example, example_tr, video_id, uses)
   SELECT lang, term, kind, pos, level, az, alt, en, example, example_tr, video_id, uses
   FROM jsonb_to_recordset($1::jsonb) AS r(
     lang TEXT, term TEXT, kind TEXT, pos TEXT, level TEXT, az TEXT, alt JSONB, en TEXT, example TEXT,
     example_tr TEXT, video_id TEXT, uses INTEGER
   )
   ON CONFLICT (lang, term, kind) DO NOTHING`,
  [JSON.stringify(dictionary)],
);

const counts = await pool.query(
  `SELECT (SELECT COUNT(*) FROM videos) AS videos, (SELECT COUNT(*) FROM videos WHERE status = 'ready') AS ready,
          (SELECT COUNT(*) FROM video_content) AS content, (SELECT COUNT(*) FROM dictionary) AS dictionary`,
);
console.log("copied now:", {
  videos: `${videosResult.rowCount} of ${videos.length}`,
  content: contentCopied,
  dictionary: `${dictionaryResult.rowCount} of ${dictionary.length}`,
});
console.log("postgres now holds:", counts.rows[0]);

await pool.end();
source.close();

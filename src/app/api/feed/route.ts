import { NextRequest, NextResponse } from "next/server";
import { readyVideos } from "@/lib/db";
import { filterByLevel, sliceFeed } from "@/lib/feed";
import { hasGeminiKey } from "@/lib/gemini";
import { ingestProgress, kickIngest } from "@/lib/ingest";
import { DEFAULT_LANGUAGE, isLanguageId } from "@/lib/languages";
import { LEVELS, type FeedPending, type FeedResponse, type Level } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const langParam = params.get("lang");
  const lang = isLanguageId(langParam) ? langParam : DEFAULT_LANGUAGE;
  const topic = params.get("topic") ?? "all";
  const levelParam = params.get("level") as Level | null;
  const level = levelParam && LEVELS.includes(levelParam) ? levelParam : null;
  const seed = Number(params.get("seed")) || 1;
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const limit = Math.min(20, Math.max(1, Number(params.get("limit")) || 8));

  try {
    const keyed = hasGeminiKey();
    if (keyed) kickIngest(lang, topic);

    const everything = await readyVideos(lang, "all");
    const ready = topic === "all" ? everything : everything.filter((v) => v.topics.includes(topic));
    // A video opened through a shared link goes first, whatever the topic or level.
    const first = params.get("first");
    const pinned = first ? everything.find((v) => v.id === first) : undefined;
    if (!ready.length && !pinned) {
      if (!keyed) return NextResponse.json({ error: "no_gemini_key" }, { status: 503 });
      const body: FeedPending = { pending: true, ready: 0, ...ingestProgress() };
      return NextResponse.json(body, { status: 202 });
    }

    const pool = filterByLevel(ready.length ? ready : everything, level).filter((v) => v.id !== pinned?.id);
    let items = pool.length ? sliceFeed(pool, seed, offset, limit) : [];
    if (pinned) {
      // The pinned video takes position 0, the normal feed follows shifted by one.
      const rest = pool.length ? sliceFeed(pool, seed, Math.max(0, offset - 1), offset === 0 ? limit - 1 : limit) : [];
      const shifted = rest.map((v) => ({ ...v, index: v.index + 1 }));
      items = offset === 0 ? [{ ...pinned, index: 0 }, ...shifted] : shifted;
    }
    const body: FeedResponse = {
      items,
      nextOffset: offset + limit,
      total: pool.length,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[feed]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { readyVideos, videoById, type ReadyVideo } from "@/lib/db";
import { filterByLevel, levelDistance, sliceFeed } from "@/lib/feed";
import { hasGeminiKey } from "@/lib/gemini";
import { ingestProgress, kickIngest, requestVideo } from "@/lib/ingest";
import { DEFAULT_LANGUAGE, isLanguageId } from "@/lib/languages";
import { LEVELS, type FeedPending, type FeedRedirect, type FeedResponse, type Level } from "@/lib/types";

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
    if (keyed) kickIngest(lang, topic, level);

    // Videos opened by their link belong to no topic: they can be pinned, but they are not part of the feed.
    const everything = (await readyVideos(lang, "all")).filter((v) => v.topics.length);
    const ready = topic === "all" ? everything : everything.filter((v) => v.topics.includes(topic));

    // A video opened by its link goes first, whatever its topic or level. It may be in another
    // language than the viewer's, or not analysed yet: then it is prepared now, while they wait.
    const first = params.get("first");
    const linked = first && /^[\w-]{11}$/.test(first) ? await videoById(first) : null;
    let pinned: ReadyVideo | undefined;
    let notice: string | undefined;
    if (linked?.status === "ready") {
      if (linked.lang === lang) pinned = linked.video;
      else if (offset === 0) return NextResponse.json({ language: linked.lang } satisfies FeedRedirect);
    } else if (first && offset === 0 && /^[\w-]{11}$/.test(first)) {
      const outcome = requestVideo(first, lang, linked);
      if (outcome.pending) {
        const body: FeedPending = { pending: true, video: first, ready: 0, running: true, error: outcome.error };
        return NextResponse.json(body, { status: 202 });
      }
      notice = outcome.reason;
    }

    if (!ready.length && !pinned) {
      if (!keyed) return NextResponse.json({ error: "no_gemini_key" }, { status: 503 });
      const body: FeedPending = { pending: true, ready: 0, ...ingestProgress() };
      return NextResponse.json(body, { status: 202 });
    }

    const pool = filterByLevel(ready.length ? ready : everything, level).filter((v) => v.id !== pinned?.id);
    // With a level chosen, each pass over the pool starts with that level and moves outwards.
    const rank = level ? (v: (typeof pool)[number]) => levelDistance(v.level, level) : undefined;
    let items = pool.length ? sliceFeed(pool, seed, offset, limit, rank) : [];
    if (pinned) {
      // The pinned video takes position 0, the normal feed follows shifted by one.
      const rest = pool.length ? sliceFeed(pool, seed, Math.max(0, offset - 1), offset === 0 ? limit - 1 : limit, rank) : [];
      const shifted = rest.map((v) => ({ ...v, index: v.index + 1 }));
      items = offset === 0 ? [{ ...pinned, index: 0 }, ...shifted] : shifted;
    }
    const body: FeedResponse = {
      items,
      nextOffset: offset + limit,
      total: pool.length,
      notice,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[feed]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { searchDictionary } from "@/lib/db";
import { DEFAULT_LANGUAGE, isLanguageId } from "@/lib/languages";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const langParam = params.get("lang");
  const kindParam = params.get("kind");
  const kind = kindParam === "word" || kindParam === "phrase" ? kindParam : "all";

  const result = await searchDictionary({
    lang: isLanguageId(langParam) ? langParam : DEFAULT_LANGUAGE,
    q: (params.get("q") ?? "").trim().slice(0, 60),
    kind,
    limit: Math.min(60, Math.max(1, Number(params.get("limit")) || 30)),
    offset: Math.max(0, Number(params.get("offset")) || 0),
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

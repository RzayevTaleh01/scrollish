import { NextResponse } from "next/server";
import { getContent } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{11}$/.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const content = await getContent(id);
  if (!content) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(content, { headers: { "Cache-Control": "private, max-age=3600" } });
}

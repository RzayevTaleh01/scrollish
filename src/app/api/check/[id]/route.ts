import { NextResponse } from "next/server";
import { checkVideo } from "@/lib/check";

export const dynamic = "force-dynamic";

/** What the page to add a video shows before sending the viewer on: see checkVideo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{11}$/.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  try {
    return NextResponse.json(await checkVideo(id), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[check]", id, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}

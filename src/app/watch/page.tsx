import { redirect } from "next/navigation";

/** YouTube's other address for a video, /watch?v=<id>, leads to the same place as /shorts/<id>. */
export default async function WatchPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  redirect(v && /^[\w-]{11}$/.test(v) ? `/shorts/${v}` : "/");
}

import { notFound } from "next/navigation";
import { Feed } from "@/components/Feed";

/**
 * A video by its YouTube address: take a Shorts link, put this site's name where youtube.com was,
 * and the same video opens here with its tappable subtitles.
 */
export default async function ShortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{11}$/.test(id)) notFound();
  return <Feed />;
}

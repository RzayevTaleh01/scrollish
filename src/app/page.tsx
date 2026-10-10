import { redirect } from "next/navigation";
import { Feed } from "@/components/Feed";

export default async function Home({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  // Links to a video used to look like /?v=<id>. They still work, at the address videos have now.
  const { v } = await searchParams;
  if (v && /^[\w-]{11}$/.test(v)) redirect(`/shorts/${v}`);
  return <Feed landing />;
}

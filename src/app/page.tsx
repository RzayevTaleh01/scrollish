import { Feed } from "@/components/Feed";

export default async function Home({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  // A link to a video opens straight on that video, behind the short splash. Everyone else gets the home page.
  const { v } = await searchParams;
  return <Feed landing={!v} />;
}

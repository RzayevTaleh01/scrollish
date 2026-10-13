const VIDEO_ID = /^[\w-]{11}$/;

/**
 * The video in a YouTube link, as pasted: a Shorts link, a /watch?v= link, a youtu.be link,
 * this site's own /shorts/ address, or the bare 11 character id. Null when there is none.
 */
export function youTubeId(text: string): string | null {
  const value = text.trim();
  if (VIDEO_ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const v = url.searchParams.get("v");
  if (v && VIDEO_ID.test(v)) return v;
  return /^\/(?:shorts\/|embed\/|live\/)?([\w-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
}

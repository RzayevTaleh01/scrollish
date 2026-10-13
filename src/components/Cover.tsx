"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Width of the image YouTube sends in place of a cover that does not exist. */
const PLACEHOLDER_WIDTH = 120;

const smallCover = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const uprightCover = (id: string) => `https://i.ytimg.com/vi/${id}/oar2.jpg`;

const preloaded = new Set<string>();

/**
 * Fetches the covers of a video before its slide comes up, so a swipe lands on a picture at once
 * rather than on black while the video itself is still loading.
 */
export function preloadCover(id: string) {
  if (preloaded.has(id)) return;
  preloaded.add(id);
  for (const src of [smallCover(id), uprightCover(id)]) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
  }
}

/** An image that fades in once it has arrived. A cached one may be complete before React hears of it. */
function FadeImage({
  src,
  onLoad,
  onError,
}: {
  src: string;
  onLoad?: (image: HTMLImageElement) => boolean | void;
  onError?: () => void;
}) {
  const [shown, setShown] = useState(false);
  const arrived = (image: HTMLImageElement) => {
    if (onLoad?.(image) !== false) setShown(true);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(image) => {
        if (image?.complete && image.naturalWidth && !shown) arrived(image);
      }}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={(e) => arrived(e.currentTarget)}
      onError={onError}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-300",
        shown ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/**
 * The cover of a Short in its own upright shape, up to 1080x1920. Grey and breathing until a picture
 * arrives. The small landscape cover is drawn under the upright one: it arrives first, so there is a
 * picture at once, and it stays when a video has no upright cover (YouTube then answers with a tiny
 * grey placeholder). Each one fades in, so nothing pops.
 * Give it the video id as `key` wherever the same element is reused for another video.
 */
export function Cover({ id, className }: { id: string; className?: string }) {
  const [upright, setUpright] = useState(true);
  const [ready, setReady] = useState(false);

  return (
    <span aria-hidden className={cn("absolute inset-0", className)}>
      {/* Its own layer: the skeleton's breathing must not reach the pictures. */}
      {!ready && <span className="skeleton absolute inset-0" />}
      <FadeImage src={smallCover(id)} onLoad={() => setReady(true)} />
      {upright && (
        <FadeImage
          src={uprightCover(id)}
          onLoad={(image) => {
            if (image.naturalWidth > PLACEHOLDER_WIDTH) return true;
            setUpright(false);
            return false;
          }}
          onError={() => setUpright(false)}
        />
      )}
    </span>
  );
}

"use client";

import { UserRound } from "lucide-react";
import { useState } from "react";
import { useAccount } from "@/lib/account";
import { cn } from "@/lib/cn";

/**
 * The Profile icon: the Google picture of the viewer once signed in, the outline of a person otherwise.
 * `pictureClassName` is for the picture only, such as a ring round it while its tab is open.
 */
export function ProfileIcon({
  size,
  strokeWidth,
  pictureClassName,
}: {
  size: number;
  strokeWidth?: number;
  pictureClassName?: string;
}) {
  const { account } = useAccount();
  const [failed, setFailed] = useState<string | null>(null);
  const picture = account?.picture;

  if (!picture || failed === picture) return <UserRound size={size} strokeWidth={strokeWidth} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={picture}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(picture)}
      className={cn("shrink-0 rounded-full object-cover", pictureClassName)}
      style={{ width: size, height: size }}
    />
  );
}

import { cn } from "@/lib/cn";
import type { Level } from "@/lib/types";

const TONE: Record<Level, string> = {
  A1: "bg-emerald-400",
  A2: "bg-emerald-400",
  B1: "bg-amber-400",
  B2: "bg-amber-400",
  C1: "bg-rose-400",
  C2: "bg-rose-400",
};

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-none text-black", TONE[level], className)}>
      {level}
    </span>
  );
}

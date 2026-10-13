import { cn } from "@/lib/cn";

/** Speech bubble with a play button, in two flat colors. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={cn("shrink-0", className)} aria-hidden>
      <rect width="48" height="48" rx="14" className="fill-accent" />
      <path
        d="M15 11h18a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H25l-8.5 6.5V33H15a6 6 0 0 1-6-6V17a6 6 0 0 1 6-6z"
        className="fill-accent-ink"
      />
      <path d="M21.5 18.2v9.6l8-4.8z" className="fill-accent" />
    </svg>
  );
}

/** The name, set like the headlines of the home page: heavy capitals, tightly spaced. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-black uppercase tracking-tight", className)}>
      Scroll<span className="text-accent">ish</span>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <Wordmark className="hidden text-[19px] md:inline" />
    </div>
  );
}

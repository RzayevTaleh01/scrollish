"use client";

import { Link2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { usePresence } from "@/lib/presence";
import { youTubeId } from "@/lib/youtube-link";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, HEADLINE, TILE } from "./brand";

interface Props {
  open: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
}

/**
 * The plus button: a YouTube video by its link. It opens at the top of the feed, and is
 * analysed first if Scrollish has not seen it yet. Sits high on the screen, clear of the keyboard.
 */
export function AddVideo({ open, onOpen, onClose }: Props) {
  const { mounted, closing } = usePresence(open);
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = youTubeId(link);
    if (id) onOpen(id);
    else setInvalid(true);
  };

  if (!mounted) return null;

  return (
    <div
      onClick={onClose}
      className={cn(
        closing ? "pointer-events-none animate-fade-out" : "animate-fade-in",
        "fixed inset-0 z-[45] flex items-start justify-center bg-black/60 px-4 pt-[calc(env(safe-area-inset-top)+14vh)]",
      )}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className={cn(TILE, closing ? "animate-sink" : "animate-rise", "w-full max-w-md p-5")}
      >
        <h2 className={cn(HEADLINE, "text-2xl")}>Add a video</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Paste a YouTube Shorts link. Its subtitles become tappable, every word explained in Azerbaijani.
        </p>
        <label className="mt-4 flex h-12 cursor-text items-center gap-2.5 rounded-lg border border-line bg-bg px-3.5 focus-within:border-accent">
          <Link2 size={18} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setInvalid(false);
            }}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="youtube.com/shorts/..."
            aria-label="YouTube link"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
        </label>
        {invalid && <p className="mt-2 text-sm text-rose-300">That does not look like a YouTube video link.</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={cn(BUTTON_SECONDARY, "h-11 px-5 text-sm")}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!link.trim()}
            className={cn(BUTTON_PRIMARY, "h-11 flex-1 text-sm")}
          >
            Open video
          </button>
        </div>
      </form>
    </div>
  );
}

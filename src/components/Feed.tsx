"use client";

import { ChevronDown, ChevronUp, KeyRound, Loader2, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { topicsForLanguage } from "@/lib/channels";
import { earlySeed, FEED_PAGE_SIZE, linkedVideo, takeEarlyFeed, videoPath } from "@/lib/boot";
import { cn } from "@/lib/cn";
import { isLanguageId } from "@/lib/languages";
import { likedFrom, readLiked, writeLiked, type LikedVideo } from "@/lib/liked";
import { SavedProvider, useSaved } from "@/lib/saved";
import { SettingsProvider, useSettings } from "@/lib/settings";
import type { FeedItem, FeedPending, FeedRedirect, FeedResponse, Level } from "@/lib/types";
import { loadYouTubeApi } from "@/lib/youtube-iframe";
import { Dictionary } from "./Dictionary";
import { Landing } from "./Landing";
import { Liked } from "./Liked";
import { Onboarding } from "./Onboarding";
import { Settings } from "./Settings";
import { ShortSlide } from "./ShortSlide";
import { TopBar } from "./TopBar";

type Status = "loading" | "preparing" | "ready" | "empty" | "error" | "nokey";
type LoadMode = "reset" | "more" | "poll";

interface FeedQuery {
  topic: string;
  lang: string;
  level: Level | null;
}

const PREFETCH_AHEAD = 4;
/** Videos kept loaded and buffered around the one on screen, so a swipe either way starts at once. */
const PLAYERS_AHEAD = 2;
const PLAYERS_BEHIND = 1;
/**
 * The feed is drawn with this many slides, however long the list is. Each one builds its YouTube
 * player once and keeps it: a slide that has been left behind is moved to the far end of the list
 * and handed the next video. Building a player is the slow part, loading a clip into one is quick.
 */
const SLIDES = PLAYERS_BEHIND + 1 + PLAYERS_AHEAD;
/**
 * The other players wait until the video on screen is under way, so they do not compete with it
 * for the network and the processor. A video that never gets going holds them back this long at most.
 */
const HOLD_MAX_MS = 2500;
/** The first time round, the players further from the video on screen are built this much later each. */
const BUILD_STAGGER_MS = 700;
const POLL_MS = 3000;
const HEADER_HIDE_MS = 3000;
const TOAST_MS = 2600;
const TRANSLATION_KEY = "socialearn:translation";
/** Set once the viewer has been asked which language and level they want. */
const ASKED_KEY = "socialearn:asked";

/** `landing` shows the home page before the feed; without it the page opens straight on the video. */
export function Feed({ landing = false }: { landing?: boolean }) {
  return (
    <SettingsProvider>
      <SavedProvider>
        <FeedScreen landing={landing} />
      </SavedProvider>
    </SettingsProvider>
  );
}

function FeedScreen({ landing }: { landing: boolean }) {
  const saved = useSaved();
  const settings = useSettings();
  const [selectedTopic, setTopic] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [pending, setPending] = useState<FeedPending | null>(null);
  const [started, setStarted] = useState(!landing);
  /** The home page is up first, unless a video link was opened, and again whenever the logo is pressed. */
  const [home, setHome] = useState(landing);
  /** Whether the language and level question has been answered before, and whether it is on screen now. */
  const [asked, setAsked] = useState(true);
  const [asking, setAsking] = useState(false);
  /**
   * Opened straight on a video, nothing has been tapped yet, and until something is browsers only
   * let a page play video silently. The first tap or key press anywhere turns the sound on.
   */
  const [soundLocked, setSoundLocked] = useState(!landing);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [likedOpen, setLikedOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [translation, setTranslation] = useState(true);
  const [liked, setLiked] = useState<LikedVideo[]>([]);
  const likedIds = useMemo(() => new Set(liked.map((v) => v.id)), [liked]);
  const [toast, setToast] = useState<string | null>(null);
  /** Whether the video on screen is playing, and whether the phone header has been tucked away for it. */
  const [playing, setPlaying] = useState(false);
  const [headerAway, setHeaderAway] = useState(false);
  /** The slide whose video is under way (see `onSettled` of the slide), or -1. */
  const [settledAt, setSettledAt] = useState(-1);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef(0);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const generationRef = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  /**
   * A video opened through a shared link or from the liked list: it is shown first.
   * Once it has been shown, the next topic, language or level change drops it.
   */
  const sharedRef = useRef<{ id: string; lang: string | null; shownFor: FeedQuery | null } | null>(null);

  // A topic picked in one language may not exist in another: fall back to all topics.
  const topic =
    selectedTopic === "all" || (topicsForLanguage(settings.language) as string[]).includes(selectedTopic)
      ? selectedTopic
      : "all";
  const query = useMemo<FeedQuery>(
    () => ({ topic, lang: settings.language, level: settings.level }),
    [topic, settings.language, settings.level],
  );
  const overlayOpen = dictionaryOpen || settingsOpen || likedOpen;

  // Phones, like the play button: while a video plays the header leaves after a moment,
  // and it comes back as soon as the video stops.
  useEffect(() => {
    if (!playing) {
      setHeaderAway(false);
      return;
    }
    const timer = window.setTimeout(() => setHeaderAway(true), HEADER_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [playing]);
  const headerHidden = headerAway && playing && started && status === "ready" && !overlayOpen;

  const flash = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // The feed switches language itself when a linked video turns out to be in another one.
  const switchLanguage = useRef(settings.setLanguage);
  useEffect(() => {
    switchLanguage.current = settings.setLanguage;
  });

  const load = useCallback(async (feed: FeedQuery, mode: LoadMode) => {
    if (mode === "more") {
      if (loadingRef.current) return;
    } else {
      generationRef.current++;
      offsetRef.current = 0;
    }
    if (mode === "reset") {
      setItems([]);
      setActive(0);
      setSettledAt(-1);
      setStatus("loading");
      scrollerRef.current?.scrollTo({ top: 0 });
    }

    const generation = generationRef.current;
    loadingRef.current = true;

    try {
      const params = new URLSearchParams({
        lang: feed.lang,
        topic: feed.topic,
        seed: String(seedRef.current),
        offset: String(offsetRef.current),
        limit: String(FEED_PAGE_SIZE),
      });
      if (feed.level) params.set("level", feed.level);
      if (sharedRef.current) params.set("first", sharedRef.current.id);
      const url = `/api/feed?${params}`;
      // The first page was already asked for from <head>: that answer is used when it is the same request.
      const res = await (takeEarlyFeed(url) ?? fetch(url));
      if (generation !== generationRef.current) return;

      if (res.status === 202) {
        setPending((await res.json()) as FeedPending);
        setStatus("preparing");
        return;
      }
      if (res.status === 503) {
        setStatus("nokey");
        return;
      }
      if (res.status === 404) {
        setStatus("empty");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));

      const data: FeedResponse | FeedRedirect = await res.json();
      if (generation !== generationRef.current) return;

      if ("language" in data) {
        // The linked video is in another language: switching to it asks for the feed again, video first.
        if (sharedRef.current) sharedRef.current.shownFor = null;
        if (isLanguageId(data.language)) switchLanguage.current(data.language);
        return;
      }
      if (data.notice) {
        // The linked video cannot be shown: the ordinary feed came instead, with the reason.
        sharedRef.current = null;
        flash(data.notice);
      }

      offsetRef.current = data.nextOffset;
      // Pages join up exactly (the server works out every position from the seed), so nothing is
      // filtered here: dropping repeats used to stall the feed when fewer than ~20 videos were ready.
      setItems((prev) => (mode === "more" ? [...prev, ...data.items] : data.items));
      setStatus("ready");
    } catch {
      if (generation === generationRef.current && mode !== "more") setStatus("error");
    } finally {
      if (generation === generationRef.current) loadingRef.current = false;
    }
  }, [flash]);

  useEffect(() => {
    seedRef.current = earlySeed() ?? Math.floor(Math.random() * 1_000_000_000);
    // Fetched alongside the feed, so the first players can be built the moment the feed arrives.
    void loadYouTubeApi();
    const shared = linkedVideo();
    if (shared) sharedRef.current = { id: shared, lang: null, shownFor: null };
    setLiked(readLiked());
    try {
      setTranslation(localStorage.getItem(TRANSLATION_KEY) !== "0");
      setAsked(localStorage.getItem(ASKED_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!soundLocked) return;
    const unlock = () => setSoundLocked(false);
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [soundLocked]);

  // Reloads whenever the topic, the language or the level changes.
  useEffect(() => {
    if (!settings.ready) return;
    const shared = sharedRef.current;
    if (shared?.shownFor && shared.shownFor !== query) {
      sharedRef.current = null;
    } else if (shared && !shared.shownFor) {
      // A shared link carries the language of its video: switch to it before loading.
      const linked = shared.lang;
      shared.lang = null;
      if (isLanguageId(linked) && linked !== settings.language) {
        settings.setLanguage(linked);
        return;
      }
      shared.shownFor = query;
    }
    load(query, "reset");
  }, [query, settings, load]);

  // The address bar follows the video on screen, like YouTube, so the page can be copied or reloaded as is.
  // Not before the first tap: until then the visitor is still on the home page.
  const currentId = items[active]?.id;
  useEffect(() => {
    if (!currentId || !started) return;
    window.history.replaceState(null, "", videoPath(currentId));
  }, [currentId, started]);

  // While the server is still analysing the first videos, check again every few seconds.
  useEffect(() => {
    if (status !== "preparing") return;
    const timer = window.setTimeout(() => load(query, "poll"), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [status, pending, query, load]);

  // Endless loop: keep the queue filled a few clips ahead of the viewer.
  useEffect(() => {
    if (status === "ready" && active >= items.length - PREFETCH_AHEAD) load(query, "more");
  }, [active, items.length, status, query, load]);

  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setTimeout(() => setSettledAt(active), HOLD_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [active, status]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-slide]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length, status]);

  const go = useCallback(
    (delta: number) => {
      const next = scrollerRef.current?.querySelector(`[data-index="${active + delta}"]`);
      next?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [active],
  );

  useEffect(() => {
    if (!started || overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "m" && !soundLocked) {
        // While the sound is locked the key press itself unlocks it, and that is all it should do.
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, overlayOpen, soundLocked, go]);

  const toggleLike = useCallback(
    (item: FeedItem) => {
      setLiked((prev) => {
        const next = prev.some((v) => v.id === item.id)
          ? prev.filter((v) => v.id !== item.id)
          : [likedFrom(item, settings.language), ...prev];
        writeLiked(next);
        return next;
      });
    },
    [settings.language],
  );

  const removeLike = useCallback((id: string) => {
    setLiked((prev) => {
      const next = prev.filter((v) => v.id !== id);
      writeLiked(next);
      return next;
    });
  }, []);

  /** Opens a liked video at the top of the feed, in its own language. */
  const openLiked = useCallback(
    (video: LikedVideo) => {
      setLikedOpen(false);
      if (isLanguageId(video.lang) && video.lang !== settings.language) {
        sharedRef.current = { id: video.id, lang: video.lang, shownFor: null };
        settings.setLanguage(video.lang);
        return;
      }
      sharedRef.current = { id: video.id, lang: null, shownFor: query };
      load(query, "reset");
    },
    [settings, query, load],
  );

  const toggleTranslation = useCallback(() => {
    setTranslation((on) => {
      try {
        localStorage.setItem(TRANSLATION_KEY, on ? "0" : "1");
      } catch {}
      return !on;
    });
  }, []);

  /** Back to the home page: the video stops and the address is the plain home address again. */
  const goHome = useCallback(() => {
    setHome(true);
    setStarted(false);
    window.history.replaceState(null, "", "/");
  }, []);

  // With the sound still locked the tap has already unlocked it: muting again would undo that.
  const toggleMute = useCallback(() => {
    if (!soundLocked) setMuted((m) => !m);
  }, [soundLocked]);

  /** Leaves the home page for the feed, by way of the language and level question the first time. */
  const begin = useCallback(() => {
    if (asked) setStarted(true);
    else setAsking(true);
  }, [asked]);

  const finishAsking = useCallback(() => {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {}
    setAsked(true);
    setAsking(false);
    setStarted(true);
  }, []);

  const share = useCallback(
    async (item: FeedItem) => {
      const url = window.location.origin + videoPath(item.id);
      try {
        if (navigator.share) {
          await navigator.share({ title: item.title, url });
        } else {
          await navigator.clipboard.writeText(url);
          flash("Link copied");
        }
      } catch {}
    },
    [flash],
  );

  // The first position that has a slide: one behind the video on screen, short of the ends of the list.
  const firstSlide = Math.max(0, Math.min(active - PLAYERS_BEHIND, items.length - SLIDES));

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <TopBar
        language={settings.language}
        topic={topic}
        onTopic={setTopic}
        savedCount={saved.items.filter((i) => i.lang === settings.language).length}
        hidden={headerHidden}
        onHome={goHome}
        onOpenLiked={() => setLikedOpen(true)}
        onOpenDictionary={() => setDictionaryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {status === "ready" && (
        <div
          ref={scrollerRef}
          className="no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
        >
          {/*
            The slides cover the positions around the video on screen. They are listed by slide, not by
            position, so a slide never changes place in the page: moving it there would reload its player.
          */}
          {Array.from({ length: Math.min(SLIDES, items.length) }, (_, slide) => {
            const position = firstSlide + ((((slide - firstSlide) % SLIDES) + SLIDES) % SLIDES);
            const item = items[position];
            return (
              <ShortSlide
                key={slide}
                item={item}
                position={position}
                active={started && !overlayOpen && position === active}
                hold={position !== active && settledAt !== active}
                current={position === active}
                buildDelay={Math.max(0, Math.abs(position - active) - 1) * BUILD_STAGGER_MS}
                muted={muted || soundLocked}
                soundLocked={soundLocked}
                translation={translation}
                liked={likedIds.has(item.id)}
                onLike={toggleLike}
                onTranslation={toggleTranslation}
                onMute={toggleMute}
                onShare={share}
                onPlayback={setPlaying}
                onSettled={setSettledAt}
              />
            );
          })}
        </div>
      )}

      {/*
        Phones: YouTube draws its own title, logo and menu along the top of the video. This blurred band
        always covers them, with the header floating over it when it is shown. Taps pass through to the video.
      */}
      {status === "ready" && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-20 h-[calc(env(safe-area-inset-top)+64px)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
        />
      )}

      {status === "loading" && <Skeleton />}
      {status === "preparing" && <Preparing pending={pending} />}
      {status === "nokey" && <MissingKey />}
      {status === "empty" && (
        <Message title="No videos in this topic yet" action="Show all topics" onAction={() => setTopic("all")} />
      )}
      {status === "error" && (
        <Message title="Could not load videos" action="Try again" onAction={() => load(query, "reset")} />
      )}

      {status === "ready" && (
        <div className="absolute right-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <NavButton label="Previous" disabled={active === 0} onClick={() => go(-1)}>
            <ChevronUp size={22} />
          </NavButton>
          <NavButton label="Next" onClick={() => go(1)}>
            <ChevronDown size={22} />
          </NavButton>
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-8 z-50 flex justify-center transition duration-300",
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <span className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black">{toast}</span>
      </div>

      {dictionaryOpen && <Dictionary onClose={() => setDictionaryOpen(false)} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {likedOpen && (
        <Liked items={liked} onOpen={openLiked} onRemove={removeLike} onClose={() => setLikedOpen(false)} />
      )}
      {home && <Landing open={!started} items={items} onStart={begin} onLanguage={settings.setLanguage} />}
      {asking && <Onboarding onBack={() => setAsking(false)} onDone={finishAsking} />}
    </main>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="liquid glass-soft grid size-12 place-items-center rounded-full hover:bg-white/15 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function CardFrame({ children, pulse }: { children?: React.ReactNode; pulse?: boolean }) {
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center pt-[var(--top)]">
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 bg-surface px-8 text-center md:rounded-3xl",
          pulse && "animate-pulse",
        )}
        style={{ width: "var(--card-w)", height: "var(--card-h)" }}
      >
        {children}
      </div>
    </div>
  );
}

function Skeleton() {
  return <CardFrame pulse />;
}

function Preparing({ pending }: { pending: FeedPending | null }) {
  return (
    <CardFrame>
      <Loader2 size={30} className="animate-spin text-accent" />
      <p className="text-lg font-semibold">{pending?.video ? "Preparing this video" : "Preparing your videos"}</p>
      <p className="max-w-[260px] text-sm leading-relaxed text-muted">
        {pending?.video
          ? "Nobody has opened this video here before. Its subtitles are being read and translated, once. That takes about a minute, and after that it opens instantly for everyone."
          : "Subtitles are being fetched and translated once with Gemini, a few videos per request. The first videos take about a minute, after that they open instantly."}
      </p>
      {pending?.error && (
        <p className="max-w-[280px] rounded-lg bg-surface-2 px-3 py-2 text-xs text-rose-300">{pending.error}</p>
      )}
    </CardFrame>
  );
}

function MissingKey() {
  return (
    <CardFrame>
      <KeyRound size={30} className="text-accent" />
      <p className="text-lg font-semibold">Gemini key needed</p>
      <p className="max-w-[270px] text-sm leading-relaxed text-muted">
        Add <code className="rounded bg-surface-2 px-1.5 py-0.5 text-white">GEMINI_API_KEY</code> to{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-white">.env.local</code>, restart the dev server and
        refresh this page.
      </p>
    </CardFrame>
  );
}

function Message({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <button
        onClick={onAction}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition active:scale-95"
      >
        <RotateCw size={16} />
        {action}
      </button>
    </div>
  );
}

"use client";

import { ArrowRight, Bookmark, BookOpen, Heart, Languages, Play, Share2, Volume2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { LANGUAGES, type LanguageId } from "@/lib/languages";
import { TOPICS } from "@/lib/topics";
import { LEVELS, type FeedItem, type Level } from "@/lib/types";
import { Cover } from "./Cover";
import { LevelBadge } from "./LevelBadge";
import { LogoMark, Wordmark } from "./Logo";
import { OVERLAY_CARD, OVERLAY_PRIMARY_TEXT, OVERLAY_SECONDARY_TEXT } from "./overlay";

interface Props {
  open: boolean;
  /** Videos already waiting behind this page: their covers fill the phone in the hero. */
  items: FeedItem[];
  /** Leaves for the feed. A first-time visitor is asked for a language and a level on the way. */
  onStart: () => void;
  onLanguage: (language: LanguageId) => void;
}

export const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted";
export const HEADLINE = "font-black uppercase leading-[0.95] tracking-tight";
const SECTION = "mx-auto w-full max-w-6xl px-5 md:px-8";

interface Sheet {
  kind: string;
  tag: string;
  level: Level;
  term: string;
  az: string;
}

interface Demo {
  words: string[];
  /** First and last word of the part that gets tapped. */
  picked: [number, number];
  phrase?: boolean;
  tr: string;
  level: Level;
  sheet: Sheet;
}

/** The lines shown on the phone in the hero. On each one a word is tapped, saved, and the video swiped away. */
const DEMO: Demo[] = [
  {
    words: ["This", "recipe", "is", "surprisingly", "easy"],
    picked: [3, 3],
    tr: "Bu resept təəccüblü dərəcədə asandır",
    level: "A2",
    sheet: { kind: "Word", tag: "adverb", level: "B1", term: "surprisingly", az: "təəccüblü dərəcədə" },
  },
  {
    words: ["I", "finally", "figured", "it", "out"],
    picked: [2, 4],
    phrase: true,
    tr: "Nəhayət bunu başa düşdüm",
    level: "B1",
    sheet: { kind: "Phrase", tag: "phrasal verb", level: "B1", term: "figure out", az: "başa düşmək, həll etmək" },
  },
  {
    words: ["Octopuses", "have", "three", "hearts"],
    picked: [3, 3],
    tr: "Ahtapotların üç ürəyi var",
    level: "A2",
    sheet: { kind: "Word", tag: "noun", level: "A1", term: "heart", az: "ürək" },
  },
];

/**
 * What the finger on the phone is doing, shown under it. The times are seconds into one slide
 * and follow the gestures in globals.css (demo-tap, demo-swipe-down, demo-swipe-up).
 */
const GESTURES = [
  { at: 0.2, text: "Tap any word" },
  { at: 1.8, text: "Save it to your dictionary" },
  { at: 3.4, text: "Swipe to the next video" },
];

const STEPS = [
  {
    title: "Scroll",
    text: "A feed of real short videos in the language you are learning. Pick a topic and a level, or just keep swiping.",
  },
  {
    title: "Tap",
    text: "Every word in the subtitles is a button. Tap one and the video waits while you read what it means in Azerbaijani.",
  },
  {
    title: "Keep",
    text: "Save the words worth remembering. They land in your dictionary with the sentence and the video they came from.",
  },
];

const FEATURES = [
  {
    title: "Tappable subtitles",
    text: "No more pausing to look a word up in another tab. The meaning opens right on the video, for the sense used in that sentence.",
  },
  {
    title: "Phrases, not just words",
    text: "Idioms, phrasal verbs and collocations are underlined and taught as one unit, because “figure out” is not “figure” plus “out”.",
  },
  {
    title: "A translation under every line",
    text: "Each subtitle line carries its Azerbaijani translation in yellow. One button hides it when you want to test yourself.",
  },
  {
    title: "Graded from A1 to C2",
    text: "Every video and every word has a CEFR level. Set yours in Settings and the feed keeps to what you can follow.",
  },
  {
    title: "Your own dictionary",
    text: "Saved words keep their part of speech, level, example sentence and source video, and can be read aloud.",
  },
  {
    title: "Full transcript on wide screens",
    text: "On a laptop the whole transcript sits beside the video and follows along. Click a line to jump to it.",
  },
];

const PIPELINE = [
  {
    title: "Curated channels",
    text: "Shorts come from a hand-picked list of YouTube channels per language and topic, and play in YouTube’s own player.",
  },
  {
    title: "Captions",
    text: "The captions of each video are fetched and cut into short lines that are timed to the speech.",
  },
  {
    title: "One analysis",
    text: "Gemini translates every line, glosses every word and marks the phrases. This happens once per video, never while you watch.",
  },
  {
    title: "Word memory",
    text: "Translations that videos agree on are reused. About 7 in 10 words of a new video are already known.",
  },
  {
    title: "Instant feed",
    text: "Everything is stored, and the next two videos are loaded ahead of you, so a swipe starts playing at once.",
  },
];

const FAQ = [
  {
    q: "What is Scrollish?",
    a: "A way to learn a language from short videos. You scroll a feed like on any video app, and every word and phrase in the subtitles can be tapped for its meaning.",
  },
  {
    q: "Which languages can I learn?",
    a: `${LANGUAGES.map((l) => l.label).join(" and ")} for now. Meanings and translations are always given in Azerbaijani.`,
  },
  {
    q: "Do I need to sign up?",
    a: "No. There are no accounts. Your saved words, liked videos and settings stay in this browser on this device.",
  },
  {
    q: "Where do the videos come from?",
    a: "They are YouTube Shorts from channels chosen for each topic, shown through YouTube’s player. Scrollish adds the subtitles, translations and word meanings on top.",
  },
  {
    q: "Why does the first tap matter?",
    a: "Browsers only let a page play sound after you touch it. One tap on Start is enough, and from then on videos play as you scroll.",
  },
];

/** The home page. It sits over the feed, which loads its first videos while this is being read. */
export function Landing({ open, items, onStart, onLanguage }: Props) {
  const [mounted, setMounted] = useState(true);
  // Taken out of the page once it has faded away, and put back when the logo brings the visitor home.
  if (open && !mounted) setMounted(true);
  if (!mounted) return null;

  const learn = (language: LanguageId) => {
    onLanguage(language);
    onStart();
  };

  return (
    <div
      data-landing
      className={cn(
        "fixed inset-0 z-50 overflow-y-auto scroll-smooth bg-bg transition-opacity duration-300",
        !open && "pointer-events-none opacity-0",
      )}
      onTransitionEnd={(e) => e.target === e.currentTarget && !open && setMounted(false)}
    >
      <header className="sticky top-0 z-10 border-b border-line bg-bg pt-[env(safe-area-inset-top)]">
        <div className={cn(SECTION, "flex h-14 items-center gap-6")}>
          <button
            onClick={(e) => e.currentTarget.closest("[data-landing]")?.scrollTo({ top: 0 })}
            aria-label="Scrollish home"
            className="liquid flex items-center gap-2.5 rounded-xl"
          >
            <LogoMark size={28} />
            <Wordmark className="text-[19px]" />
          </button>
          <nav className="ml-2 hidden gap-6 text-sm font-medium text-muted md:flex">
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#system" className="hover:text-white">
              Under the hood
            </a>
            <a href="#faq" className="hover:text-white">
              Questions
            </a>
          </nav>
          <button
            onClick={onStart}
            className="liquid ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black"
          >
            Start watching
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      <section className={cn(SECTION, "grid items-center gap-12 py-12 md:grid-cols-[1fr_auto] md:gap-16 md:py-20")}>
        <div className="animate-rise">
          <p className={EYEBROW}>Learn {LANGUAGES.map((l) => l.label).join(" and ")} from short videos</p>
          <h1 className={cn(HEADLINE, "mt-5 text-[44px] md:text-7xl")}>
            Scroll real videos. <span className="text-accent">Tap any word.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            <Wordmark className="text-white" /> turns short videos into language lessons. Every word and phrase in the
            subtitles is tappable and explained in <span className="text-translation">Azerbaijani</span>, graded by
            level, and one tap away from your own dictionary.
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
            {LANGUAGES.map((language) => (
              <button
                key={language.id}
                onClick={() => learn(language.id)}
                className="liquid group rounded-lg border border-line bg-surface p-4 text-left hover:border-accent"
              >
                <span className="block text-lg font-bold">{language.label}</span>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-accent px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent group-hover:bg-accent group-hover:text-accent-ink">
                  Watch
                  <ArrowRight size={12} />
                </span>
              </button>
            ))}
          </div>
          <p className={cn(EYEBROW, "mt-4")}>Free in your browser. No sign-up.</p>
        </div>

        <Phone items={items} />
      </section>

      <section className="border-y border-line">
        <div className={cn(SECTION, "grid grid-cols-2 md:grid-cols-4")}>
          <Stat value={String(LANGUAGES.length)} label="Languages to learn, explained in Azerbaijani" />
          <Stat value={String(LEVELS.length)} label={`Levels, from ${LEVELS[0]} to ${LEVELS[LEVELS.length - 1]}`} />
          <Stat value={String(TOPICS.length)} label="Topics, from science to comedy" />
          <Stat value="1" label="Tap to see what a word means" />
        </div>
      </section>

      <section id="how" className={cn(SECTION, "scroll-mt-14 py-16 md:py-24")}>
        <p className={EYEBROW}>How it works</p>
        <h2 className={cn(HEADLINE, "mt-4 max-w-3xl text-4xl md:text-5xl")}>Watch like always. Learn on the way.</h2>
        <div className="mt-10 grid border-l border-t border-line md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="border-b border-r border-line p-6 md:p-8">
              <span className="text-sm font-bold text-accent">{i + 1}</span>
              <h3 className={cn(HEADLINE, "mt-3 text-2xl")}>{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-14 border-y border-line bg-surface">
        <div className={cn(SECTION, "py-16 md:py-24")}>
          <p className={EYEBROW}>What you get</p>
          <h2 className={cn(HEADLINE, "mt-4 max-w-3xl text-4xl md:text-5xl")}>Subtitles that answer back.</h2>
          <div className="mt-10 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="border-b border-r border-line bg-bg p-6 md:p-8">
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{feature.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className={cn(EYEBROW, "mr-2")}>Topics</span>
            {TOPICS.map((topic) => (
              <span key={topic.id} className="rounded-md border border-line bg-bg px-2.5 py-1 text-sm font-medium">
                {topic.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="system" className={cn(SECTION, "scroll-mt-14 py-16 md:py-24")}>
        <p className={EYEBROW}>Under the hood</p>
        <h2 className={cn(HEADLINE, "mt-4 max-w-3xl text-4xl md:text-5xl")}>
          Analysed once. <span className="text-accent">Ready before you swipe.</span>
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Nothing is translated while you wait. Each video goes through the same five steps before it is allowed into
          the feed.
        </p>
        <ol className="mt-10 grid border-l border-t border-line md:grid-cols-5">
          {PIPELINE.map((step, i) => (
            <li key={step.title} className="border-b border-r border-line p-5 md:p-6">
              <span className={EYEBROW}>Step {i + 1}</span>
              <h3 className="mt-2.5 text-base font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="scroll-mt-14 border-t border-line bg-surface">
        <div className={cn(SECTION, "py-16 md:py-24")}>
          <p className={EYEBROW}>Questions</p>
          <h2 className={cn(HEADLINE, "mt-4 text-4xl md:text-5xl")}>The short answers.</h2>
          <div className="mt-10 max-w-3xl border-t border-line">
            {FAQ.map((item, i) => (
              <details key={item.q} open={i === 0} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold uppercase tracking-wide [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="text-xl font-normal text-accent group-open:rotate-45">+</span>
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(SECTION, "py-20 text-center md:py-28")}>
        <h2 className={cn(HEADLINE, "text-4xl md:text-6xl")}>Watch your first video.</h2>
        <button
          onClick={onStart}
          className="liquid mt-9 inline-flex h-14 items-center gap-2.5 rounded-lg bg-white px-10 text-base font-semibold text-black"
        >
          <Play size={18} className="fill-current" />
          Start
        </button>
        <p className="mt-5 text-xs text-muted">One tap lets the videos play with sound.</p>
      </section>

      <footer className="border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className={cn(SECTION, "flex h-16 items-center justify-between text-xs text-muted")}>
          <Wordmark className="text-sm text-white" />
          <span>Videos are played through YouTube.</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-line px-1 py-7 odd:border-r md:border-r md:px-6 md:last:border-r-0 [&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-b-0">
      <p className="text-4xl font-black tracking-tight md:text-5xl">{value}</p>
      <p className={cn(EYEBROW, "mt-2 leading-relaxed")}>{label}</p>
    </div>
  );
}

/** Sets when a gesture starts, in seconds into its slide. */
function at(seconds: number) {
  return { "--at": `${seconds}s` } as CSSProperties;
}

/**
 * A phone that uses the feed on its own: a word is tapped, its sheet slides up, the word is saved,
 * the sheet is swiped away and the next video is swiped in. The timing lives in globals.css.
 */
function Phone({ items }: { items: FeedItem[] }) {
  // The first slide is repeated at the end, so the loop can jump back to the top unseen.
  const slides = [...DEMO, DEMO[0]];

  return (
    <div className="mx-auto w-[264px] shrink-0 md:w-[292px]">
      <div className="rounded-[40px] border-2 border-white/90 bg-black p-2">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[32px] bg-surface">
          <div className="phone-feed h-full">
            {slides.map((demo, i) => {
              const turn = i % DEMO.length;
              const item = items.length ? items[turn % items.length] : null;
              return <PhoneSlide key={i} demo={demo} turn={turn} item={item} />;
            })}
          </div>
          <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 p-3">
            <LogoMark size={22} />
            <span className="glass rounded-full px-2.5 py-1 text-[10px] font-semibold">All</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-black">Science</span>
            <span className="glass ml-auto grid size-7 place-items-center rounded-full">
              <Heart size={13} />
            </span>
            {/* The dictionary: its dot jumps each time a word is saved below. */}
            <span className="glass relative grid size-7 place-items-center rounded-full">
              <BookOpen size={13} />
              <span className="demo-badge absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent" />
            </span>
          </div>
        </div>
      </div>

      <div aria-hidden className="relative mt-4 h-5">
        {GESTURES.map((gesture) => (
          <p
            key={gesture.text}
            style={at(gesture.at)}
            className={cn(EYEBROW, "demo-caption absolute inset-0 text-center text-white")}
          >
            {gesture.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The fingertip: a pale disc that presses down where a tap or a swipe happens. */
function Finger({ className, start }: { className: string; start: number }) {
  return (
    <span
      aria-hidden
      style={at(start)}
      className={cn("pointer-events-none absolute z-50 size-8 rounded-full border-2 border-white bg-white/40", className)}
    />
  );
}

function PhoneSlide({ demo, turn, item }: { demo: Demo; turn: number; item: FeedItem | null }) {
  const [from, to] = demo.picked;
  const before = demo.words.slice(0, from).join(" ");
  const picked = demo.words.slice(from, to + 1).join(" ");
  const after = demo.words.slice(to + 1).join(" ");

  return (
    <div className="relative h-full overflow-hidden bg-surface-2" style={{ "--turn": turn } as CSSProperties}>
      {item && <Cover key={item.id} id={item.id} />}

      <div className="absolute bottom-[104px] right-2.5 flex flex-col gap-2">
        {[Heart, Languages, Volume2, Share2].map((Icon, i) => (
          <span key={i} className="glass grid size-9 place-items-center rounded-full">
            <Icon size={15} />
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-2.5 pr-14">
        <div className={cn(OVERLAY_CARD, "px-3 py-2")}>
          <p className={cn(OVERLAY_PRIMARY_TEXT, "text-[13px] leading-6")}>
            {before}{" "}
            <span
              className={cn(
                "demo-pick relative rounded-md px-0.5 py-0.5",
                demo.phrase && "underline decoration-accent decoration-2 underline-offset-4",
              )}
            >
              {picked}
              <Finger start={0.4} className="demo-tap left-1/2 top-1/2 -ml-4 -mt-4" />
            </span>{" "}
            {after}
          </p>
          <p className={cn(OVERLAY_SECONDARY_TEXT, "mt-1 border-t border-white/15 pt-1 text-[11px] text-translation")}>
            {demo.tr}
          </p>
        </div>
        <div className={cn(OVERLAY_CARD, "flex items-center gap-2 py-1.5 pl-1.5 pr-3")}>
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/20 text-[10px] font-bold">
            {(item?.channelTitle ?? "S").charAt(0)}
          </span>
          <span className="truncate text-[11px] font-semibold">{item?.channelTitle ?? "Scrollish"}</span>
          <LevelBadge level={item?.level ?? demo.level} className="shrink-0" />
        </div>
      </div>

      <div className="demo-sheet glass-strong absolute inset-x-0 bottom-0 rounded-t-2xl px-3.5 pb-4 pt-2">
        <div className="mx-auto mb-2.5 h-1 w-8 rounded-full bg-white/30" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <SheetTag>{demo.sheet.kind}</SheetTag>
              <SheetTag>{demo.sheet.tag}</SheetTag>
              <LevelBadge level={demo.sheet.level} />
            </div>
            <p className="mt-2 text-xl font-bold leading-tight">{demo.sheet.term}</p>
          </div>
          <span className="demo-save relative grid size-8 shrink-0 place-items-center rounded-full">
            <Bookmark size={15} />
            <Finger start={1.9} className="demo-tap left-0 top-0" />
          </span>
        </div>
        <p className="mt-2.5 text-base font-semibold leading-snug text-translation">{demo.sheet.az}</p>
        <p className="glass-soft mt-2.5 rounded-xl p-2.5 text-xs leading-relaxed">
          {before} <span className="font-semibold text-accent">{picked}</span> {after}
        </p>
      </div>

      {/* The sheet is pulled down by its handle, then the whole video is pushed up and away. */}
      <Finger start={3} className="demo-swipe-down bottom-[150px] left-1/2 -ml-4" />
      <Finger start={3.75} className="demo-swipe-up left-1/2 top-[58%] -ml-4" />
    </div>
  );
}

function SheetTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

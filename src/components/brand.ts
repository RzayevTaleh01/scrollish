/**
 * The design language of the home page, in one place, so every screen speaks it the same way:
 * solid colors and 1px lines (no gradients, no glows), small radii, heavy uppercase headlines,
 * and the brand color always carrying dark ink, as in the logo.
 *
 * Radii, and nothing in between: 6px (rounded-md) tags and badges; 8px (rounded-lg) tiles, buttons
 * and chips; 12px (rounded-xl) cards on the video and the video card on a phone; 16px (rounded-2xl)
 * the bars at the bottom of a phone and the video card on desktop; 24px (rounded-3xl) the sheets;
 * round for icon buttons.
 */

/** Small label over a headline or a section. */
export const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted";
/** Headlines: heavy capitals, tightly set. */
export const HEADLINE = "font-black uppercase leading-[0.95] tracking-tight";
/** Title of a full-screen panel. */
export const PANEL_TITLE = `${HEADLINE} text-3xl`;

/** The brand color, with its dark ink. */
export const ACCENT = "bg-accent text-accent-ink";
/** A tile on the page: the surface color with a line round it. */
export const TILE = "rounded-lg border border-line bg-surface";
/** Phones: the navigation bar floating at the bottom, glass (see glass-bar in globals.css). */
export const BAR = "rounded-2xl glass-bar";
/** A tile that can be picked: the line turns to the brand color on hover, the whole tile when picked. */
export const CHOICE = "liquid rounded-lg border text-left";
export const CHOICE_IDLE = "border-line bg-surface hover:border-accent";
export const CHOICE_PICKED = "border-accent bg-accent text-accent-ink";

/** The main action: white with black text. */
export const BUTTON_PRIMARY =
  "liquid inline-flex items-center justify-center gap-2 rounded-lg bg-white font-semibold text-black disabled:opacity-40";
/** A second action next to it: a tile. */
export const BUTTON_SECONDARY =
  "liquid inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface font-semibold hover:border-accent";

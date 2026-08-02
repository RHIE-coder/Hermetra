import type { FeedbackRect, FeedbackTarget } from '@shared/dev-feedback';

export type Point = { x: number; y: number };

/** Drawing tools. Only the eraser makes no stroke — it picks up an existing one. */
export type Tool = 'pen' | 'line' | 'arrow' | 'box' | 'eraser';
export type DrawTool = Exclude<Tool, 'eraser'>;

/**
 * One stroke.
 * `points` means different things per tool — for the pen it is every point the
 * cursor passed through, for the rest it is just [start, end]. What line that
 * actually becomes is known in exactly one place: `polylinesOf` (draw.ts).
 */
export type Shape = {
  tool: DrawTool;
  points: Point[];
  color: string;
  width: number;
};

/** A mark being edited on screen, not yet saved. */
export type DraftMark = {
  id: number;
  /** A tapped position (pin) or a drawn stroke (shape). The gesture decides. */
  kind: 'pin' | 'shape';
  /** Null for a pin — it has a position and nothing drawn. */
  shape: Shape | null;
  /** Viewport coordinates. The screen is frozen while marking, so these line
   *  up with the screenshot the main process takes. */
  bounds: FeedbackRect;
  memo: string;
  target: FeedbackTarget | null;
  /** "This is how it should look" — a PNG data URL from the sketch pad. */
  sketch: string | null;
};

/** Default mark colour. */
export const MARK_COLOR = '#eb4e63';
/** White casing under every stroke so a mark stays legible on a dark surface. */
export const MARK_HALO = 'rgba(255,255,255,0.92)';
export const MARK_WIDTH = 3;

/**
 * Pen colours. These deliberately skip the app's design tokens: they are not
 * CSS but values baked into an SVG and a PNG, and the moment this tool is
 * needed is the moment the theme itself may be wrong.
 * Five is enough for the user to assign their own meaning to a colour; more
 * turns picking one into work.
 */
export const PALETTE = [MARK_COLOR, '#2f6df6', '#17a34a', '#f59e0b', '#1f2130'] as const;

/** Colour of the "has a drawing" tell (badge shoulder dot, edit label). Same
 *  green as the palette, named separately so retuning the palette does not
 *  silently retune the tell. */
export const SKETCH_BADGE_COLOR = '#17a34a';

/** Three widths. The middle one is the default. */
export const WIDTHS = [2, MARK_WIDTH, 6] as const;

/** The sketch pad starts white on purpose: laying the screen underneath would
 *  turn it into "fix the current screen", which is what on-screen drawing does. */
export const SKETCH_BACKGROUND = '#ffffff';

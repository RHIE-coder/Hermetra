// Drawing geometry — the only place that knows what line a shape becomes.
//
// Why it is split out: the same stroke is drawn twice, by the on-screen SVG
// while marking and by the sketch pad when it bakes its PNG. If each computed
// its own coordinates, what the user saw and what got saved would drift apart,
// and that drift is invisible until after it has been sent. So every tool is
// expressed as one set of polylines and both places read this function.
import { MARK_HALO, type Point, type Shape } from './types';

/** Arrowhead length — it has to grow with the stroke or it drowns in it. */
function headLength(width: number): number {
  return Math.max(11, width * 3.5);
}

/** How wide the head spreads (radians). Narrow reads as a nail, wide as a chevron. */
const HEAD_SPREAD = 0.42;

/**
 * The polylines needed to draw one shape.
 * An empty array means there is nothing to draw yet (a single point, say).
 */
export function polylinesOf(shape: Shape): Point[][] {
  const pts = shape.points;
  if (pts.length === 0) return [];
  const a = pts[0];
  const b = pts[pts.length - 1];
  switch (shape.tool) {
    case 'pen':
      return pts.length < 2 ? [] : [pts];
    case 'line':
      return [[a, b]];
    case 'arrow': {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const len = headLength(shape.width);
      const wing = (turn: number): Point => ({
        x: b.x - len * Math.cos(angle + turn),
        y: b.y - len * Math.sin(angle + turn),
      });
      // The head is its own disconnected polyline — joined to the shaft, the
      // stroke doubles back over itself and that stretch comes out thicker.
      return [
        [a, b],
        [wing(-HEAD_SPREAD), b, wing(HEAD_SPREAD)],
      ];
    }
    case 'box':
      return [[a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a]];
  }
}

export function boundsOfPoints(points: Point[]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** What the stroke actually covers, arrowhead included — measure the shaft
 *  alone and the head hangs outside the badge. */
export function boundsOfShape(shape: Shape) {
  return boundsOfPoints(polylinesOf(shape).flat());
}

/** The SVG `d` string. Used on screen and by the sketch pad. */
export function svgPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
}

/**
 * Bakes strokes onto a canvas. The white casing goes down first so the mark
 * stays legible over a dark surface. Coordinates move by `(p - offset) * scale`.
 */
export function strokeShapes(
  ctx: CanvasRenderingContext2D,
  shapes: readonly Shape[],
  scale: number,
  offsetX = 0,
  offsetY = 0,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const shape of shapes) {
    const lines = polylinesOf(shape);
    if (lines.length === 0) continue;
    const trace = () => {
      ctx.beginPath();
      for (const line of lines) {
        line.forEach((p, i) => {
          const x = (p.x - offsetX) * scale;
          const y = (p.y - offsetY) * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      }
    };
    trace();
    ctx.strokeStyle = MARK_HALO;
    ctx.lineWidth = (shape.width + 3) * scale;
    ctx.stroke();
    trace();
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width * scale;
    ctx.stroke();
  }
}

/** Distance from p to segment ab — the ruler behind "the eraser touched this". */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  // A zero-length segment (two identical points) falls back to point distance
  // rather than dividing by zero.
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Is (x, y) on this stroke? A thicker stroke gets a wider test — it also looks wider. */
export function shapeContains(shape: Shape, x: number, y: number, slack = 8): number | null {
  const p = { x, y };
  let best: number | null = null;
  for (const line of polylinesOf(shape)) {
    for (let i = 1; i < line.length; i += 1) {
      const d = distanceToSegment(p, line[i - 1], line[i]);
      if (d <= shape.width / 2 + slack && (best === null || d < best)) best = d;
    }
  }
  return best;
}

/**
 * Id of the mark the eraser picks up. When strokes overlap the **nearer** one
 * wins — "the later one wins" would let a thick stroke make the thin one under
 * it permanently unerasable.
 * A pin has no stroke; `badgeHit` answers for those.
 */
export function eraserHit<T extends { id: number; shape: Shape | null }>(
  marks: readonly T[],
  x: number,
  y: number,
): number | null {
  let hitId: number | null = null;
  let hitDist = Number.POSITIVE_INFINITY;
  for (const m of marks) {
    if (!m.shape) continue;
    const d = shapeContains(m.shape, x, y);
    if (d !== null && d < hitDist) {
      hitDist = d;
      hitId = m.id;
    }
  }
  return hitId;
}

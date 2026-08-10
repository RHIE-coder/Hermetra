// Sketch pad — draw "this is how it should look" and attach it to a mark.
//
// It splits the work with on-screen drawing: on screen says **where** (it
// points at real UI), this says **how** (it proposes something that does not
// exist yet). Hence the white board — laying the screen underneath would turn
// it into "fix the current screen", which is the other half's job.
//
// While drawing it lives as SVG and is baked to canvas exactly once, on
// attach. Drawing straight onto canvas would mean redrawing everything for a
// single undo, and two copies of the same stroke code.
import { useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { polylinesOf, strokeShapes, svgPath, strokeHit } from './draw';
import { ToolStrip } from './tool-strip';
import {
  MARK_COLOR,
  MARK_HALO,
  MARK_WIDTH,
  SKETCH_BACKGROUND,
  type DrawTool,
  type Point,
  type Shape,
  type Tool,
} from './types';

// A gesture shorter than this is a graze, not a stroke.
const MIN_STROKE = 6;
// Export scale. A white board with a few strokes stays small at 2x, and text
// scribbled on it has to stay legible.
const EXPORT_SCALE = 2;

type Placed = { id: number; shape: Shape };

export function SketchPad({
  label,
  initial,
  onCancel,
  onDone,
}: {
  /** Which mark this drawing belongs to (①②③…), so several do not blur together. */
  label: string;
  /** An existing drawing is only announced, not reloaded — reopening means redrawing. */
  initial: string | null;
  onCancel: () => void;
  onDone: (dataUrl: string | null) => void;
}) {
  const t = useT();
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(MARK_COLOR);
  const [width, setWidth] = useState<number>(MARK_WIDTH);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const downAt = useRef<Point | null>(null);

  /** Screen coordinates to board coordinates — the board floats mid-window, so
   *  using them raw would offset every stroke. */
  const local = (e: React.PointerEvent): Point => {
    const box = boardRef.current?.getBoundingClientRect();
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = local(e);
    if (tool === 'eraser') {
      const hit = strokeHit(placed, p.x, p.y);
      if (hit !== null) setPlaced((prev) => prev.filter((s) => s.id !== hit));
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* refused for a non-active pointer — drawing itself must carry on */
    }
    downAt.current = p;
    setDraft({ tool: tool as DrawTool, points: [p], color, width });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const p = local(e);
    setDraft((prev) => {
      if (!prev) return prev;
      // The pen is the path it travels; every other tool is start and now.
      if (prev.tool === 'pen') {
        const last = prev.points[prev.points.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return prev;
        return { ...prev, points: [...prev.points, p] };
      }
      return { ...prev, points: [prev.points[0], p] };
    });
  };

  const onUp = () => {
    const start = downAt.current;
    const shape = draft;
    downAt.current = null;
    setDraft(null);
    if (!shape || !start) return;
    const end = shape.points[shape.points.length - 1];
    if (shape.tool !== 'pen' && Math.hypot(end.x - start.x, end.y - start.y) < MIN_STROKE) return;
    if (polylinesOf(shape).length === 0) return;
    setPlaced((prev) => [...prev, { id: nextId.current++, shape }]);
  };

  /** Bakes the drawing to PNG. Nothing drawn means null — an empty white board
   *  is not worth a file. */
  const bake = (): string | null => {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box || placed.length === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(box.width * EXPORT_SCALE);
    canvas.height = Math.round(box.height * EXPORT_SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = SKETCH_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokeShapes(
      ctx,
      placed.map((p) => p.shape),
      EXPORT_SCALE,
    );
    return canvas.toDataURL('image/png');
  };

  const shapes = [...placed.map((p) => p.shape), ...(draft ? [draft] : [])];
  const btn =
    'rounded-md px-2.5 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted disabled:opacity-40';

  return (
    // Covers on-screen drawing entirely — nothing may be drawn behind an open pad.
    <div className="absolute inset-0 z-10 flex flex-col gap-2 bg-black/45 p-3 backdrop-blur-[2px]">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold"
          style={{ color: MARK_COLOR }}
        >
          {label}
        </span>
        <span className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
          {t('devFeedback.sketch.title')}
        </span>
      </div>

      <div
        ref={boardRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ background: SKETCH_BACKGROUND, cursor: tool === 'eraser' ? 'pointer' : 'crosshair' }}
        className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-lg shadow-lg"
        data-testid="dev-feedback-sketch-board"
      >
        <svg className="absolute inset-0 h-full w-full">
          {shapes.map((shape, i) =>
            polylinesOf(shape).map((line, j) => (
              <g key={`${i}-${j}`}>
                {/* White casing first, so a stroke reads over a dark colour —
                    the same rule the on-screen overlay follows. */}
                <path
                  d={svgPath(line)}
                  fill="none"
                  stroke={MARK_HALO}
                  strokeWidth={shape.width + 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={svgPath(line)}
                  fill="none"
                  stroke={shape.color}
                  strokeWidth={shape.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )),
          )}
        </svg>
        {placed.length === 0 && !draft ? (
          // Fixed dark ink: the board is always white, whatever the app theme is.
          <p
            className="pointer-events-none absolute inset-0 grid place-items-center text-xs"
            style={{ color: '#6b7280' }}
          >
            {initial ? t('devFeedback.sketch.replace') : t('devFeedback.sketch.empty')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <ToolStrip
          tool={tool}
          onTool={setTool}
          color={color}
          onColor={setColor}
          width={width}
          onWidth={setWidth}
        />
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-card/95 px-1 py-1 shadow-lg">
          <button
            type="button"
            className={btn}
            disabled={placed.length === 0}
            onClick={() => setPlaced((prev) => prev.slice(0, -1))}
          >
            {t('devFeedback.undo')}
          </button>
          <button
            type="button"
            className={btn}
            disabled={placed.length === 0}
            onClick={() => setPlaced([])}
          >
            {t('devFeedback.sketch.clearAll')}
          </button>
          {/* The way to take an attached drawing off again. Reopening and not
              drawing leaves it in place, so this needs its own button. */}
          {initial ? (
            <button type="button" className={btn} onClick={() => onDone(null)}>
              {t('devFeedback.sketch.detach')}
            </button>
          ) : null}
          <button type="button" className={btn} onClick={onCancel}>
            {t('devFeedback.close')}
          </button>
          <button
            type="button"
            disabled={placed.length === 0}
            onClick={() => onDone(bake())}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t('devFeedback.sketch.attach')}
          </button>
        </div>
      </div>
    </div>
  );
}

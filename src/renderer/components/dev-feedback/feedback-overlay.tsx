// Dev-only screen feedback overlay.
//
// Where things sit is most of this design. The corners are taken: the sidebar
// footer holds the bottom-left, dialogs and toasts land bottom-right, and the
// top edge is the drag region of a frameless window. So the trigger lives on
// the right edge at mid-height, where every screen is empty, and can be dragged
// up or down if it is ever in the way — the app remembers where.
//
// Once marking starts the trigger disappears and only the toolbar is left: a
// spot occupied by a control is a spot you cannot give feedback about. The
// toolbar can flip top/bottom for the same reason.
//
// It deliberately uses nothing from `components/ui`. The moment this tool is
// wanted is the moment the screen is broken, and a tool built out of the thing
// under inspection goes down with it.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BADGE_RADIUS,
  badgeCenter,
  badgeHit,
  markLabel,
  type FeedbackRect,
} from '@shared/dev-feedback';
import { CHANNELS } from '@shared/ipc/channels';
import { invoke } from '@/services/ipc';
import { useT } from '@/lib/i18n';
import { FEEDBACK_ATTR, targetInBounds } from './inspect';
import { boundsOfShape, eraserHit, polylinesOf, svgPath } from './draw';
import { SketchPad } from './sketch-pad';
import { ToolStrip } from './tool-strip';
import {
  MARK_COLOR,
  MARK_HALO,
  MARK_WIDTH,
  SKETCH_BADGE_COLOR,
  type DrawTool,
  type DraftMark,
  type Point,
  type Shape,
  type Tool,
} from './types';

const HANDLE_TOP_KEY = 'hermetra.devFeedback.handleTop';
const DOCK_KEY = 'hermetra.devFeedback.dock';
// Move this far and it is a drag, not a tap. A tap pins, a drag draws.
const DRAG_SLOP = 6;
// A stroke smaller than this was a graze.
const MIN_STROKE = 12;

/** Pointer capture is a nicety. Drawing has to survive it being refused. */
function capturePointer(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* the browser refuses for a non-active pointer */
  }
}

function readStored(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* if storage is blocked, only the remembered position is lost */
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Bounds of a pinned point — a badge-sized square centred on it.
 * Why not 0x0: both `badgeCenter` and `targetInBounds` work from the top-left
 * corner inwards by the radius. At 0x0 the badge would sit a radius away from
 * the spot that was tapped, and the element probe would miss by the same.
 */
function pinBounds(p: Point): FeedbackRect {
  return {
    x: p.x - BADGE_RADIUS,
    y: p.y - BADGE_RADIUS,
    width: BADGE_RADIUS * 2,
    height: BADGE_RADIUS * 2,
  };
}

/** Puts the note box beside its mark, flipping above when there is no room below. */
function bubblePosition(bounds: FeedbackRect, dock: 'top' | 'bottom') {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const width = Math.min(292, vw - 16);
  const height = 96;
  const below = bounds.y + bounds.height + 10;
  // Never against the edge the toolbar is docked to.
  const topLimit = dock === 'top' ? 64 : 8;
  const bottomLimit = dock === 'bottom' ? vh - 64 : vh - 8;
  const top =
    below + height < bottomLimit ? below : clamp(bounds.y - height - 10, topLimit, bottomLimit - height);
  return { top, left: clamp(bounds.x, 8, Math.max(8, vw - width - 8)), width };
}

/** The route the marks belong to. HashRouter, so the screen is in the hash. */
function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, '').split('?')[0];
  return hash.startsWith('/') ? hash : '/';
}

/** Which theme the screen was in. next-themes writes the resolved one here. */
function currentTheme(): 'light' | 'dark' | null {
  const value = document.documentElement.dataset.theme;
  return value === 'light' || value === 'dark' ? value : null;
}

/**
 * Resolves after the browser has painted what was just rendered. Two frames:
 * the first is queued before the paint of this commit, the second after it.
 * The main process screenshots the real window, so the toolbars have to be
 * gone from the glass — not just from the React tree — before it fires.
 */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 50)));
  });
}

export function FeedbackOverlay() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<DraftMark[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [handleTop, setHandleTop] = useState(50);
  const [dock, setDock] = useState<'top' | 'bottom'>('top');
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(MARK_COLOR);
  const [width, setWidth] = useState<number>(MARK_WIDTH);
  /** The mark whose sketch pad is open. While it is, on-screen drawing is covered. */
  const [sketchFor, setSketchFor] = useState<number | null>(null);

  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHandleTop(clamp(Number(readStored(HANDLE_TOP_KEY, '50')) || 50, 8, 92));
    setDock(readStored(DOCK_KEY, 'top') === 'bottom' ? 'bottom' : 'top');
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setMarks([]);
    setDraft(null);
    setEditingId(null);
    setHoverId(null);
    setListOpen(false);
    setSketchFor(null);
  }, []);

  // Freeze the screen. If an animation or a scroll moves things while marking,
  // the mark ends up pointing at a different element than the one under it.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.setAttribute('data-hermetra-frozen', '');
    const style = document.createElement('style');
    style.textContent =
      '[data-hermetra-frozen] *, [data-hermetra-frozen] *::before, [data-hermetra-frozen] *::after' +
      '{animation-play-state:paused!important;transition-property:none!important;}';
    document.head.appendChild(style);
    const stopWheel = (e: WheelEvent) => e.preventDefault();
    window.addEventListener('wheel', stopWheel, { passive: false });
    return () => {
      root.removeAttribute('data-hermetra-frozen');
      style.remove();
      window.removeEventListener('wheel', stopWheel);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        // One layer at a time: sketch pad → note → list → overlay, so a stray
        // Escape never throws every mark away.
        if (sketchFor !== null) setSketchFor(null);
        else if (editingId !== null) setEditingId(null);
        else if (listOpen) setListOpen(false);
        else close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, editingId, listOpen, sketchFor, close]);

  useEffect(() => {
    // With the pad up, it is the subject — do not pull focus to the note box
    // hidden behind it.
    if (editingId !== null && sketchFor === null) inputRef.current?.focus();
  }, [editingId, sketchFor]);

  // --- Handle: a tap opens, a drag moves it and is remembered ---
  const dragState = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null);

  const onHandleDown = (e: React.PointerEvent) => {
    capturePointer(e.currentTarget, e.pointerId);
    dragState.current = { startY: e.clientY, startTop: handleTop, moved: false };
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dy) < DRAG_SLOP) return;
    drag.moved = true;
    setHandleTop(clamp(drag.startTop + (dy / window.innerHeight) * 100, 8, 92));
  };

  const onHandleUp = () => {
    const drag = dragState.current;
    dragState.current = null;
    if (!drag) return;
    if (drag.moved) store(HANDLE_TOP_KEY, String(Math.round(handleTop)));
    else setOpen(true);
  };

  /** Adds a mark and opens its note straight away — pins and strokes come in
   *  through the same door. */
  const addMark = (mark: Omit<DraftMark, 'id' | 'memo' | 'target' | 'sketch'>) => {
    const id = nextId.current++;
    setMarks((prev) => [
      ...prev,
      { ...mark, id, memo: '', target: targetInBounds(mark.bounds), sketch: null },
    ]);
    setEditingId(id);
  };

  // --- Pinning and drawing ---
  // Badges sit on the canvas too, so three things have to be told apart:
  // pressing a badge (reopen its note), pressing empty space (pin), and
  // dragging from there (draw). One rule decides: did the pointer travel
  // DRAG_SLOP from where it went down. The handle uses the same rule.
  const downRef = useRef<{ badgeId: number | null; x: number; y: number; moved: boolean } | null>(null);

  const onDrawDown = (e: React.PointerEvent) => {
    if (editingId !== null) {
      setEditingId(null);
      return;
    }
    // The eraser makes no stroke, it picks one up. Badges come first: a pin has
    // no stroke at all, and every badge sits on top of its own stroke.
    if (tool === 'eraser') {
      const hit = badgeHit(marks, e.clientX, e.clientY) ?? eraserHit(marks, e.clientX, e.clientY);
      if (hit !== null) setMarks((prev) => prev.filter((m) => m.id !== hit));
      return;
    }
    capturePointer(e.currentTarget, e.pointerId);
    setHoverId(null);
    downRef.current = {
      badgeId: badgeHit(marks, e.clientX, e.clientY),
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    setDraft({ tool: tool as DrawTool, points: [{ x: e.clientX, y: e.clientY }], color, width });
  };

  const onDrawMove = (e: React.PointerEvent) => {
    if (!draft) {
      // Not drawing: preview the note under the cursor. Mouse only — touch has
      // no hover.
      if (e.pointerType === 'mouse' && editingId === null) {
        setHoverId(badgeHit(marks, e.clientX, e.clientY));
      }
      return;
    }
    // Drag is judged against where the pointer went down. Judged against the
    // 2px sampling step instead, a slightly shaky tap counts as a drag and
    // pressing a badge does nothing at all.
    const down = downRef.current;
    if (down && !down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= DRAG_SLOP) {
      down.moved = true;
    }
    const p = { x: e.clientX, y: e.clientY };
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

  const onDrawUp = () => {
    const down = downRef.current;
    const shape = draft;
    downRef.current = null;
    setDraft(null);
    if (!down) return;

    if (!down.moved) {
      // A badge was tapped: reopen its note rather than adding a mark.
      if (down.badgeId != null) {
        setEditingId(down.badgeId);
        return;
      }
      // Empty space was tapped — "here". A position, with nothing drawn.
      // Circling something small used to be the only way to point at it, and
      // the wide ring made the probe find the wrapper instead of the control.
      addMark({ kind: 'pin', shape: null, bounds: pinBounds({ x: down.x, y: down.y }) });
      return;
    }

    // It moved, but too little to be a stroke: **fall back to a pin**. Dropping
    // it would leave 6-12px as a dead zone where nothing happens, and the
    // intent of that gesture was "here" anyway.
    const bounds = shape ? boundsOfShape(shape) : null;
    if (!shape || !bounds || (bounds.width < MIN_STROKE && bounds.height < MIN_STROKE)) {
      addMark({ kind: 'pin', shape: null, bounds: pinBounds({ x: down.x, y: down.y }) });
      return;
    }
    addMark({ kind: 'shape', shape, bounds });
  };

  const send = async () => {
    if (marks.length === 0 || sending) return;
    setEditingId(null);
    setListOpen(false);
    setHoverId(null);
    // `sending` also strips the overlay's own chrome: the main process
    // screenshots the real window, so the toolbar has to be off the glass while
    // the marks stay on it.
    setSending(true);
    try {
      await afterPaint();
      const res = await invoke(CHANNELS.DEV_FEEDBACK_SAVE, {
        route: currentRoute(),
        viewport: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
        theme: currentTheme(),
        marks: marks.map((m) => ({
          kind: m.kind,
          memo: m.memo,
          bounds: m.bounds,
          target: m.target,
          sketch: m.sketch,
        })),
      });
      if (!res.ok) throw new Error(res.error);
      setSaved(t('devFeedback.saved', { path: res.saved }));
      close();
      window.setTimeout(() => setSaved(null), 4000);
    } catch (err) {
      console.error('[dev-feedback]', err);
      setSaved(t('devFeedback.saveFailed'));
      window.setTimeout(() => setSaved(null), 4000);
    } finally {
      setSending(false);
    }
  };

  const editing = marks.find((m) => m.id === editingId) ?? null;
  const bubble = editing ? bubblePosition(editing.bounds, dock) : null;

  // With the note box open the preview is folded away — the same information
  // does not go in two places.
  const hovered = editingId === null ? (marks.find((m) => m.id === hoverId) ?? null) : null;
  const hover = hovered
    ? {
        text: hovered.memo.trim() || t('devFeedback.noMemo'),
        top: Math.max(4, badgeCenter(hovered.bounds).y - BADGE_RADIUS - 28),
        left: clamp(
          badgeCenter(hovered.bounds).x - BADGE_RADIUS,
          8,
          Math.max(8, document.documentElement.clientWidth - 268),
        ),
        maxWidth: Math.min(260, document.documentElement.clientWidth - 16),
      }
    : null;

  // Past a couple of marks, a list beats checking badges one at a time.
  const memoList =
    listOpen && marks.length > 0 ? (
      <div
        data-testid="dev-feedback-list"
        className="pointer-events-auto max-h-52 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-card/95 p-1 text-card-foreground shadow-lg backdrop-blur-sm"
      >
        {marks.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setListOpen(false);
              setHoverId(null);
              setEditingId(m.id);
            }}
            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            <span className="mt-px shrink-0 text-xs font-semibold" style={{ color: MARK_COLOR }}>
              {markLabel(i)}
            </span>
            <span className="min-w-0 flex-1 text-xs">
              {m.memo.trim() || <span className="text-muted-foreground">{t('devFeedback.noMemo')}</span>}
              {m.sketch ? (
                <span className="ml-1 text-[10px] text-success">{t('devFeedback.sketch.has')}</span>
              ) : null}
            </span>
            <span className="mt-px shrink-0 text-[10px] text-muted-foreground">
              {m.target?.components[0] ?? m.target?.tag ?? t('devFeedback.emptySpot')}
            </span>
          </button>
        ))}
      </div>
    ) : null;

  const barSide = dock === 'top' ? 'top-0' : 'bottom-0';
  const btn =
    'rounded-md px-2.5 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted disabled:opacity-40';
  const toolStrip = (
    <ToolStrip tool={tool} onTool={setTool} color={color} onColor={setColor} width={width} onWidth={setWidth} />
  );
  const sketching = sketchFor !== null ? (marks.find((m) => m.id === sketchFor) ?? null) : null;

  if (!open) {
    return (
      <div {...{ [FEEDBACK_ATTR]: '' }} className="pointer-events-none fixed inset-0 z-[200]">
        <button
          type="button"
          data-testid="dev-feedback-handle"
          aria-label={t('devFeedback.open')}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          style={{ top: `${handleTop}%` }}
          className="pointer-events-auto absolute right-0 flex h-24 w-5 -translate-y-1/2 touch-none items-center justify-end opacity-30 hover:opacity-100 active:opacity-100"
        >
          <span className="h-16 w-1.5 rounded-l-full bg-primary" />
        </button>
        {saved ? (
          <div className="pointer-events-none absolute right-4 top-1/2 max-w-[70vw] -translate-y-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
            {saved}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div {...{ [FEEDBACK_ATTR]: '' }} className="fixed inset-0 z-[200] touch-none">
      {/* The canvas. It does not dim what is behind it — you have to keep
          seeing the problem while marking it. */}
      <svg
        data-testid="dev-feedback-canvas"
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: hoverId !== null ? 'pointer' : 'crosshair' }}
        onPointerDown={onDrawDown}
        onPointerMove={onDrawMove}
        onPointerUp={onDrawUp}
        onPointerCancel={onDrawUp}
        onPointerLeave={() => setHoverId(null)}
      >
        {[...marks.map((m) => m.shape), draft].map((shape, si) =>
          shape
            ? polylinesOf(shape).map((line, li) => (
                <g key={`s-${si}-${li}`}>
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
              ))
            : null,
        )}
        {marks.map((m, i) => {
          const c = badgeCenter(m.bounds);
          const active = hoverId === m.id || editingId === m.id;
          return (
            <g key={`badge-${m.id}`}>
              {/* The tell that it can be reopened. `badgeHit` does the judging. */}
              {active ? <circle cx={c.x} cy={c.y} r={BADGE_RADIUS + 4} fill={MARK_COLOR} opacity={0.25} /> : null}
              {/* A pin has no stroke, so only its badge shows — the ring around
                  it says "this one point". */}
              {m.kind === 'pin' ? (
                <>
                  <circle cx={c.x} cy={c.y} r={BADGE_RADIUS + 5} fill="none" stroke={MARK_HALO} strokeWidth={4} />
                  <circle cx={c.x} cy={c.y} r={BADGE_RADIUS + 5} fill="none" stroke={MARK_COLOR} strokeWidth={2} />
                </>
              ) : null}
              <circle cx={c.x} cy={c.y} r={BADGE_RADIUS} fill={MARK_COLOR} stroke={MARK_HALO} strokeWidth={2} />
              <text
                x={c.x}
                y={c.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={13}
                fill="#ffffff"
              >
                {markLabel(i)}
              </text>
              {/* A dot on the badge's shoulder when a drawing is attached, so
                  you can see which mark has one without opening the list. */}
              {m.sketch ? (
                <circle
                  cx={c.x + BADGE_RADIUS - 1}
                  cy={c.y - BADGE_RADIUS + 1}
                  r={4}
                  fill={SKETCH_BADGE_COLOR}
                  stroke={MARK_HALO}
                  strokeWidth={1.5}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Preview over a badge — check what a mark says without opening it. */}
      {hover && !sending ? (
        <div
          style={{ top: hover.top, left: hover.left, maxWidth: hover.maxWidth }}
          className="pointer-events-none absolute rounded-md bg-foreground px-2 py-1 text-[11px] text-background shadow-lg"
        >
          {hover.text}
        </div>
      ) : null}

      {/* The toolbar. A full-width bar would make that whole strip un-markable,
          so it is a centred pill with the sides left clear for the canvas; if
          the pill covers the thing you need to point at, flip it.
          It goes entirely while the sketch pad is up (hidden but present, its
          buttons would still take tab focus and duplicate the pad's own) and
          while sending (the window is being photographed). */}
      {sketching || sending ? null : (
        <div className={`pointer-events-none absolute inset-x-0 ${barSide} flex flex-col items-center gap-1 p-2`}>
          {dock === 'bottom' ? (
            <>
              {marks.length === 0 ? (
                <span className="rounded-full bg-card/90 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t('devFeedback.hint')}
                </span>
              ) : null}
              {memoList}
              {toolStrip}
            </>
          ) : null}
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-card/95 px-1 py-1 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              className={btn}
              onClick={() => {
                const next = dock === 'top' ? 'bottom' : 'top';
                setDock(next);
                store(DOCK_KEY, next);
              }}
            >
              {dock === 'top' ? t('devFeedback.dockDown') : t('devFeedback.dockUp')}
            </button>
            <button
              type="button"
              className={btn}
              disabled={marks.length === 0}
              onClick={() => {
                setListOpen((v) => !v);
                setEditingId(null);
              }}
            >
              {t('devFeedback.list')}
            </button>
            <button
              type="button"
              className={btn}
              disabled={marks.length === 0}
              onClick={() => {
                setMarks((prev) => prev.slice(0, -1));
                setEditingId(null);
              }}
            >
              {t('devFeedback.undo')}
            </button>
            <button type="button" className={btn} onClick={close}>
              {t('devFeedback.close')}
            </button>
            <button
              type="button"
              data-testid="dev-feedback-send"
              disabled={marks.length === 0}
              onClick={send}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {`${t('devFeedback.send')}${marks.length > 0 ? ` ${marks.length}` : ''}`}
            </button>
          </div>
          {dock === 'top' ? (
            <>
              {toolStrip}
              {memoList}
              {marks.length === 0 ? (
                <span className="rounded-full bg-card/90 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t('devFeedback.hint')}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {/* The note box for a mark. Struck behind the sketch pad, and while
          sending, for the same reasons as the toolbar. */}
      {editing && bubble && !sketching && !sending ? (
        <div
          style={{ top: bubble.top, left: bubble.left, width: bubble.width }}
          className="absolute rounded-lg border border-border bg-card p-2.5 text-card-foreground shadow-lg"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: MARK_COLOR }}>
              {markLabel(marks.findIndex((m) => m.id === editing.id))}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {editing.target?.components[0] ?? editing.target?.tag ?? t('devFeedback.emptySpot')}
            </span>
          </div>
          <input
            ref={inputRef}
            data-testid="dev-feedback-memo"
            value={editing.memo}
            placeholder={t('devFeedback.memoPlaceholder')}
            onChange={(e) =>
              setMarks((prev) => prev.map((m) => (m.id === editing.id ? { ...m, memo: e.target.value } : m)))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setEditingId(null);
              }
            }}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
          <div className="mt-1.5 flex items-center gap-1">
            {/* What words cannot carry, a drawing can. It sits next to the note
                because the two are one request in two forms. */}
            <button
              type="button"
              className={btn}
              onClick={() => setSketchFor(editing.id)}
              style={editing.sketch ? { color: SKETCH_BADGE_COLOR } : undefined}
            >
              {editing.sketch ? t('devFeedback.sketch.edit') : t('devFeedback.sketch.add')}
            </button>
            <span className="flex-1" />
            <button
              type="button"
              className={btn}
              onClick={() => {
                setMarks((prev) => prev.filter((m) => m.id !== editing.id));
                setEditingId(null);
              }}
            >
              {t('devFeedback.remove')}
            </button>
            <button type="button" className={btn} onClick={() => setEditingId(null)}>
              {t('devFeedback.done')}
            </button>
          </div>
        </div>
      ) : null}

      {/* The sketch pad covers on-screen drawing while it is open. */}
      {sketching ? (
        <SketchPad
          label={markLabel(marks.findIndex((m) => m.id === sketching.id))}
          initial={sketching.sketch}
          onCancel={() => setSketchFor(null)}
          onDone={(dataUrl) => {
            setMarks((prev) => prev.map((m) => (m.id === sketching.id ? { ...m, sketch: dataUrl } : m)));
            setSketchFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

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
//
// Three containers nest here: a **flow** (screens) holds **groups** (one memo
// each) holds **marks** (one stroke or pin each). Groups and screens cross —
// one memo can span several screens.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FEEDBACK_ATTR, SCROLL_ATTR, targetInBounds } from './inspect';
import { boundsOfShape, partHit, polylinesOf, svgPath } from './draw';
import { ReviewModal } from './review-modal';
import { reviewScreens } from './review';
import {
  appendPart,
  isLastPart,
  mergeMarks,
  moveStep,
  partsOnScreen,
  removeMark,
  removePart,
  removePartsOnScreen,
  removeStep,
  screenSpan,
  setMemo,
  splitMark,
} from './group';
import { SketchPad } from './sketch-pad';
import { ToolStrip } from './tool-strip';
import {
  MARK_COLOR,
  MARK_HALO,
  MARK_WIDTH,
  SKETCH_BADGE_COLOR,
  type DrawTool,
  type DraftMark,
  type DraftStep,
  type MarkPart,
  type Point,
  type Shape,
  type Tool,
} from './types';

const HANDLE_TOP_KEY = 'hermetra.devFeedback.handleTop';
const DOCK_KEY = 'hermetra.devFeedback.dock';
/**
 * Where a round in progress survives a reload.
 *
 * Walking several screens takes minutes, and the dev server repaints the page
 * on every save — which is exactly what one is doing when this tool is wanted.
 * The screen images are already on disk (in the draft folder), so only
 * coordinates, memos and sketches live here. sessionStorage, not local: closing
 * the window should end the round rather than leave someone else's story
 * attached to the next one.
 */
const RESUME_KEY = 'hermetra.devFeedback.resume';
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
  const height = 116;
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

/** Which theme this screen is in. next-themes writes the resolved one here. */
function currentTheme(): 'light' | 'dark' | null {
  const value = document.documentElement.dataset.theme;
  return value === 'light' || value === 'dark' ? value : null;
}

/** This screen's size, recorded with it — coordinates are relative to it. */
function viewportNow() {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
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

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function FeedbackOverlay() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<DraftMark[]>([]);
  /** The group whose memo box is open. While it is, every new mark **joins that
   *  group** — that is the whole of "collect several drawings into one message"
   *  (and why there is no mode switch). */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [hover, setHover] = useState<{ id: number; part: number } | null>(null);
  /** Grouping after the fact — the groups being picked in the review panel. Null when not picking. */
  const [mergeIds, setMergeIds] = useState<number[] | null>(null);
  /** One line for actions that quietly lose something (a merge, a dropped screen). */
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [handleTop, setHandleTop] = useState(50);
  const [dock, setDock] = useState<'top' | 'bottom'>('top');
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(MARK_COLOR);
  const [width, setWidth] = useState<number>(MARK_WIDTH);
  /** The group whose sketch pad is open. While it is, on-screen drawing is covered. */
  const [sketchFor, setSketchFor] = useState<number | null>(null);
  /** Screens already frozen. Their order in the array is the flow order. */
  const [steps, setSteps] = useState<DraftStep[]>([]);
  /** The draft folder collecting on disk. Minted by main on the first freeze. */
  const [draftFolder, setDraftFolder] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  /**
   * Thumbnails of the screens collected, by capture number.
   *
   * They are **not** kept with the round in `sessionStorage`: a few window PNGs
   * fill the quota, and a repaint during development would drop them anyway. The
   * pictures are already in the draft folder, so they are read when looked at.
   */
  const [shots, setShots] = useState<Record<number, string>>({});

  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Screens whose thumbnail has been asked for. Without it, a re-render while
   *  a read is in flight asks for the same picture again. */
  const shotsAsked = useRef(new Set<number>());

  /**
   * Identity of the screen being drawn on: one past the highest frozen.
   * Not the array length — dropping a screen shortens it, and reusing that
   * number would glue live marks onto a different screen.
   */
  const screen = steps.reduce((max, s) => Math.max(max, s.seq), 0) + 1;

  useEffect(() => {
    setHandleTop(clamp(Number(readStored(HANDLE_TOP_KEY, '50')) || 50, 8, 92));
    setDock(readStored(DOCK_KEY, 'top') === 'bottom' ? 'bottom' : 'top');
    // Pick up a round left mid-flight. Losing several screens to one reload
    // would mean nobody uses this twice.
    try {
      const raw = window.sessionStorage.getItem(RESUME_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as { draftFolder: string; steps: DraftStep[]; marks: DraftMark[] };
      // Shape-check rather than trust: a round saved by an older build would
      // otherwise come back as marks the renderer cannot draw.
      if (!Array.isArray(state.steps) || state.steps.length === 0) return;
      if (!Array.isArray(state.marks) || state.marks.some((m) => !Array.isArray(m.parts))) return;
      setDraftFolder(state.draftFolder);
      setSteps(state.steps);
      setMarks(state.marks);
      nextId.current = Math.max(0, ...state.marks.map((m) => m.id)) + 1;
    } catch {
      /* unreadable means start fresh — resuming is a bonus, not a premise */
    }
  }, []);

  // Keep the round in progress written down. The screen images are already on
  // disk, so this is only coordinates, memos and sketches.
  useEffect(() => {
    try {
      if (draftFolder === null) window.sessionStorage.removeItem(RESUME_KEY);
      else window.sessionStorage.setItem(RESUME_KEY, JSON.stringify({ draftFolder, steps, marks }));
    } catch {
      /* full or blocked storage costs the resume, not the round in hand */
    }
  }, [draftFolder, steps, marks]);

  /**
   * Forgets the collected thumbnails. The next round starts its screen numbers
   * at 1 again, so a picture left behind would stand in a **different** round's
   * list as if it belonged there.
   */
  const forgetShots = useCallback(() => {
    shotsAsked.current.clear();
    setShots({});
  }, []);

  /**
   * Forgets one screen's thumbnail.
   *
   * Capture numbers are **reused** once a screen is dropped (`screen` is one past
   * the highest still collected), so the next freeze can land on the number the
   * dropped screen had. Kept, its photograph would sit under a different screen
   * and the real one would never be read, because it was already asked for.
   */
  const forgetShot = useCallback((seq: number) => {
    shotsAsked.current.delete(seq);
    setShots((prev) => {
      if (!(seq in prev)) return prev;
      const next = { ...prev };
      delete next[seq];
      return next;
    });
  }, []);

  /** Folds away what is on screen. The collected flow stays alive. */
  const collapse = useCallback(() => {
    setOpen(false);
    setDraft(null);
    setEditingId(null);
    setHover(null);
    setMergeIds(null);
    setSketchFor(null);
    setReviewOpen(false);
  }, []);

  /** Throws the whole round away, including the draft on disk. */
  const close = useCallback(() => {
    collapse();
    setMarks([]);
    setSteps([]);
    setNotice(null);
    forgetShots();
    if (draftFolder) void invoke(CHANNELS.DEV_FEEDBACK_DISCARD, { draft: draftFolder }).catch(() => {});
    setDraftFolder(null);
  }, [collapse, forgetShots, draftFolder]);

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
    // Swallowing the wheel is what freezes the screen. The overlay's own long
    // lists still have to scroll, so exactly one exception is made, keyed off a
    // marker attribute — see SCROLL_ATTR. Without it the review panel cannot be
    // scrolled at all, which three screens' worth of thumbnails already needs.
    const stopWheel = (e: WheelEvent) => {
      const at = e.target;
      if (at instanceof Element && at.closest(`[${SCROLL_ATTR}]`)) return;
      e.preventDefault();
    };
    window.addEventListener('wheel', stopWheel, { passive: false });
    return () => {
      root.removeAttribute('data-hermetra-frozen');
      style.remove();
      window.removeEventListener('wheel', stopWheel);
    };
  }, [open]);

  // Reads the collected screens' pictures, once each, while the panel is up.
  // Read on opening rather than on freezing: most rounds never open the panel,
  // and a picture that is never looked at costs nothing this way.
  useEffect(() => {
    if (!reviewOpen || !draftFolder) return;
    for (const step of steps) {
      if (!step.hasImage || shotsAsked.current.has(step.seq)) continue;
      shotsAsked.current.add(step.seq);
      const seq = step.seq;
      void invoke(CHANNELS.DEV_FEEDBACK_SHOT, { draft: draftFolder, seq })
        .then((res) => {
          // Null is an ordinary answer — the panel stands on the memos and the
          // elements, and says "no picture" where one is missing.
          if (res.dataUrl) setShots((prev) => ({ ...prev, [seq]: res.dataUrl as string }));
        })
        .catch(() => {
          // Let it be asked for again next time the panel opens.
          shotsAsked.current.delete(seq);
        });
    }
  }, [reviewOpen, draftFolder, steps]);

  /** One line of feedback about the tool itself. A failure leaves the overlay
   *  open, so this is where it has to be said to be seen. */
  const say = (message: string, ms = 4000) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), ms);
  };

  /**
   * Freezes the screen in hand into the flow — main photographs the window and
   * writes it into the draft folder, and it joins the list of steps.
   *
   * **Freezing before leaving the screen is the whole point.** Photographing
   * once at send time means that the moment the user navigates, coordinates
   * from the previous screen start pointing at unrelated places on this one.
   */
  const freezeScreen = async (): Promise<{ folder: string; step: DraftStep } | null> => {
    const route = currentRoute();
    const here = { viewport: viewportNow(), theme: currentTheme() };
    try {
      // Strip our own chrome first: main photographs the real window, so the
      // toolbar has to be off the glass while the marks stay on it.
      await afterPaint();
      const res = await invoke(CHANNELS.DEV_FEEDBACK_STEP, { draft: draftFolder, seq: screen, route });
      if (!res.ok) throw new Error(res.error);
      const step: DraftStep = { seq: screen, route, ...here, hasImage: true };
      setDraftFolder(res.draft);
      setSteps((prev) => [...prev, step]);
      // Send uses what was just frozen straight away and cannot wait for state.
      return { folder: res.draft, step };
    } catch (err) {
      console.error('[dev-feedback]', err);
      say(t('devFeedback.stepFailed', { reason: reason(err) }), 6000);
      return null;
    }
  };

  /** Freezes this screen and folds the overlay away. Use the app, reopen, and
   *  the screen you are on then is the next step. */
  const nextScreen = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setEditingId(null);
    setReviewOpen(false);
    const frozen = await freezeScreen();
    setSending(false);
    if (frozen) collapse();
    // freezeScreen closes over the current marks and screen; listing it as a
    // dependency would rebuild this on every stroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, collapse, draftFolder, screen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        // One layer at a time: sketch pad → picking → review → note → overlay,
        // so a stray Escape never throws every mark away.
        //
        // Picking comes **before** review: mid-merge, Escape means "stop
        // picking", not "close the list I am picking from".
        if (sketchFor !== null) setSketchFor(null);
        else if (mergeIds !== null) setMergeIds(null);
        else if (reviewOpen) setReviewOpen(false);
        else if (editingId !== null) setEditingId(null);
        // The outermost Escape **folds**, it does not discard: minutes of work
        // across several screens must not go to one keystroke. Anything drawn
        // here is frozen first — unfrozen, those marks would lose the screen
        // they belong to and reappear floating over somebody else's.
        else if (marks.some((m) => m.parts.some((p) => p.screen === screen))) void nextScreen();
        else collapse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, editingId, mergeIds, sketchFor, reviewOpen, marks, screen, collapse, nextScreen]);

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

  /**
   * Takes one new mark. **With a memo box open it joins that group; otherwise
   * it starts a new one.** This is the only way to collect several drawings
   * into one message, and it needs no mode switch — the open box is itself the
   * sign that this group is listening.
   */
  const addPart = (part: MarkPart) => {
    if (editingId !== null) {
      setMarks((prev) => appendPart(prev, editingId, part));
      return;
    }
    const id = nextId.current++;
    setMarks((prev) => [...prev, { id, parts: [part], memo: '', sketch: null }]);
    setEditingId(id);
  };

  /** A pinned spot. The element is probed per mark, never for the group. */
  const pinPart = (p: Point): MarkPart => {
    const bounds = pinBounds(p);
    return { kind: 'pin', shape: null, bounds, target: targetInBounds(bounds), screen };
  };

  // --- Pinning and drawing ---
  // Badges sit on the canvas too, so three things have to be told apart:
  // pressing a badge (reopen its memo), pressing empty space (pin), and
  // dragging from there (draw). One rule decides: did the pointer travel
  // DRAG_SLOP from where it went down. The handle uses the same rule.
  const downRef = useRef<{ badgeId: number | null; x: number; y: number; moved: boolean } | null>(null);

  const onDrawDown = (e: React.PointerEvent) => {
    // The eraser makes no stroke, it picks one up — **one mark**, not the whole
    // group: a crooked box must not cost the sentence just typed.
    if (tool === 'eraser') {
      // Only this screen's marks: an earlier screen's are invisible here, so
      // erasing one would be erasing a ghost.
      const hit = partHit(marks, e.clientX, e.clientY, screen);
      if (!hit) return;
      // The last mark takes the group with it; close a memo box left pointing
      // at nothing.
      if (isLastPart(marks, hit.id) && editingId === hit.id) setEditingId(null);
      setMarks((prev) => removePart(prev, hit.id, hit.part));
      return;
    }
    capturePointer(e.currentTarget, e.pointerId);
    setHover(null);
    downRef.current = {
      badgeId: badgeHit(marks, e.clientX, e.clientY, screen)?.id ?? null,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    setDraft({ tool: tool as DrawTool, points: [{ x: e.clientX, y: e.clientY }], color, width });
  };

  const onDrawMove = (e: React.PointerEvent) => {
    if (!draft) {
      // Not drawing: preview the memo under the cursor. Mouse only — touch has
      // no hover.
      if (e.pointerType === 'mouse' && editingId === null) {
        setHover(badgeHit(marks, e.clientX, e.clientY, screen));
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
      // A badge was tapped: reopen its memo. The badge is the group's handle,
      // so any mark in the group opens the same one.
      if (down.badgeId != null) {
        setEditingId(down.badgeId);
        return;
      }
      // Empty space was tapped — "here". A position, with nothing drawn.
      addPart(pinPart({ x: down.x, y: down.y }));
      return;
    }

    // It moved, but too little to be a stroke: **fall back to a pin**. Dropping
    // it would leave 6-12px as a dead zone where nothing happens, and the
    // intent of that gesture was "here" anyway.
    const bounds = shape ? boundsOfShape(shape) : null;
    if (!shape || !bounds || (bounds.width < MIN_STROKE && bounds.height < MIN_STROKE)) {
      addPart(pinPart({ x: down.x, y: down.y }));
      return;
    }
    addPart({ kind: 'shape', shape, bounds, target: targetInBounds(bounds), screen });
  };

  /**
   * Undo takes **one mark**: from the open group if there is one, else from the
   * last group drawn on this screen. Taking the whole group would take the memo
   * just typed with it.
   */
  const undoLastPart = () => {
    const onHere = marks.filter((m) => m.parts.some((p) => p.screen === screen));
    const targetId = editingId ?? onHere[onHere.length - 1]?.id;
    if (targetId == null) return;
    const target = marks.find((m) => m.id === targetId);
    if (!target) return;
    // The last mark **on this screen** — taking one from an earlier screen
    // would contradict a picture already written.
    const at = target.parts.map((p) => p.screen).lastIndexOf(screen);
    if (at < 0) return;
    if (isLastPart(marks, targetId)) setEditingId(null);
    setMarks((prev) => removePart(prev, targetId, at));
  };

  /** Joins the groups picked in the list. One drawing per group, so only the
   *  first survives — and that is said out loud, not swallowed. */
  const applyMerge = () => {
    if (!mergeIds || mergeIds.length < 2) return;
    const result = mergeMarks(marks, mergeIds);
    setMarks(result.marks);
    setMergeIds(null);
    setEditingId(null);
    say(
      result.droppedSketches > 0
        ? t('devFeedback.group.mergedDropped')
        : t('devFeedback.group.merged'),
    );
  };

  const send = async () => {
    if (marks.length === 0 || sending) return;
    setSending(true);
    setEditingId(null);
    setReviewOpen(false);
    // Sending freezes the current screen first, down the same path as "next
    // screen". A separate path for the last screen would be a bug that shows up
    // only on the last screen.
    //
    // Unless **nothing was drawn here and screens are already collected**:
    // coming to a screen and sending without marking it is common, and an empty
    // screen tacked onto the end reads as the story ending somewhere it did not.
    const drewHere = marks.some((m) => m.parts.some((p) => p.screen === screen));
    let flow: DraftStep[] = steps;
    let folder = draftFolder;
    if (drewHere || steps.length === 0) {
      const frozen = await freezeScreen();
      if (!frozen) {
        setSending(false);
        return;
      }
      // What was just frozen has not reached state yet; splice it in by hand.
      flow = [...steps, frozen.step];
      folder = frozen.folder;
    }
    if (!folder) {
      say(t('devFeedback.nothingCollected'));
      setSending(false);
      return;
    }
    try {
      const res = await invoke(CHANNELS.DEV_FEEDBACK_SAVE, {
        draft: folder,
        // The list order is the flow order. `seqs` is how main renames the
        // pictures from capture order into flow order.
        seqs: flow.map((s) => s.seq),
        steps: flow.map((s) => ({
          route: s.route,
          viewport: s.viewport,
          theme: s.theme,
          hasImage: s.hasImage,
        })),
        marks: marks.map((m) => ({
          memo: m.memo,
          sketch: m.sketch,
          // The stroke points do not go: the pictures already hold the drawing,
          // and what an agent uses is the coordinates and the element. Screen
          // identity is translated into flow position on the way out.
          parts: m.parts.map((p) => ({
            kind: p.kind,
            bounds: p.bounds,
            target: p.target,
            step: flow.findIndex((s) => s.seq === p.screen) + 1,
          })),
        })),
      });
      if (!res.ok) throw new Error(res.error);
      setSaved(
        flow.some((s) => !s.hasImage)
          ? t('devFeedback.savedPartial', { path: res.saved })
          : t('devFeedback.saved', { path: res.saved }),
      );
      // It has been handed over, so the draft must not be discarded: close()
      // would delete the folder that now holds the finished feedback.
      setDraftFolder(null);
      setMarks([]);
      setSteps([]);
      // The next round numbers its screens from 1 again, so a thumbnail left
      // here would stand in that round's list as somebody else's story.
      forgetShots();
      collapse();
      window.setTimeout(() => setSaved(null), 4000);
    } catch (err) {
      console.error('[dev-feedback]', err);
      // The draft is still on disk after a failure — say so, so the user knows
      // pressing send again is worth it.
      say(t('devFeedback.saveFailed', { reason: reason(err) }), 6000);
    } finally {
      setSending(false);
    }
  };

  const editing = marks.find((m) => m.id === editingId) ?? null;
  // The memo box hangs off the group's **first mark on this screen**. Following
  // the newest mark would move the box out from under the hand mid-sentence,
  // and a group reopened from an earlier screen would put it over nothing.
  const editingHere = editing ? (partsOnScreen(editing, screen)[0] ?? null) : null;
  const bubble = editingHere ? bubblePosition(editingHere.bounds, dock) : null;

  // With the note box open the preview is folded away — the same information
  // does not go in two places.
  const hoveredMark = editingId === null && hover ? (marks.find((m) => m.id === hover.id) ?? null) : null;
  const hoveredBounds = hoveredMark?.parts[hover?.part ?? 0]?.bounds ?? null;
  const preview =
    hoveredMark && hoveredBounds
      ? {
          text: hoveredMark.memo.trim() || t('devFeedback.noMemo'),
          top: Math.max(4, badgeCenter(hoveredBounds).y - BADGE_RADIUS - 28),
          left: clamp(
            badgeCenter(hoveredBounds).x - BADGE_RADIUS,
            8,
            Math.max(8, document.documentElement.clientWidth - 268),
          ),
          maxWidth: Math.min(260, document.documentElement.clientWidth - 16),
        }
      : null;

  // The review list, derived. `screen` is the identity marks drawn right now
  // carry, so the row for the screen in hand picks them up like any other.
  const reviewList = useMemo(
    () => reviewScreens(steps, marks, { seq: screen, route: currentRoute() }),
    [steps, marks, screen],
  );

  /** "Where did this point" for the memo box — the group's first mark stands in. */
  const whereOf = (mark: DraftMark): string => {
    const target = mark.parts[0].target;
    return target?.components[0] ?? target?.tag ?? t('devFeedback.emptySpot');
  };

  const barSide = dock === 'top' ? 'top-0' : 'bottom-0';
  const btn =
    'rounded-md px-2.5 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted disabled:opacity-40';
  const hintClass = 'rounded-full bg-card/90 px-2 py-0.5 text-[11px] text-muted-foreground';
  // A group carried on from the review panel has no mark on this screen yet, so
  // its memo box has nothing to hang off and does not appear. Without a word
  // here, "draw more" looks like it did nothing at all — this line is the
  // receipt, and it says what to do next. It outranks the flow line because it
  // answers a question the user asked half a second ago.
  //
  // Being mid-flow comes next: not knowing which screen you are on, you cannot
  // tell whether "next screen" even registered.
  //
  // `live` marks the two that answer something the user just did; they are
  // drawn in the mark colour so they read as a response rather than standing
  // advice.
  const hint: { text: string; live: boolean } | null = notice
    ? { text: notice, live: true }
    : editing && !editingHere
      ? {
          text: t('devFeedback.group.continue', {
            label: markLabel(marks.findIndex((m) => m.id === editing.id)),
          }),
          live: true,
        }
      : steps.length > 0
        ? { text: t('devFeedback.flow.onScreen', { n: steps.length + 1, prev: steps.length }), live: false }
        : marks.length === 0
          ? { text: t('devFeedback.hint'), live: false }
          : null;
  const hintLine = hint ? (
    <span
      data-testid="dev-feedback-hint"
      className={hintClass}
      style={hint.live ? { color: MARK_COLOR } : undefined}
    >
      {hint.text}
    </span>
  ) : null;
  const toolStrip = (
    <ToolStrip tool={tool} onTool={setTool} color={color} onColor={setColor} width={width} onWidth={setWidth} />
  );
  const sketching = sketchFor !== null ? (marks.find((m) => m.id === sketchFor) ?? null) : null;

  if (!open) {
    // Mid-flow the handle stops being faint. Forgetting there is a round open
    // and closing the app would throw all of it away.
    const handleFade =
      steps.length > 0 ? 'opacity-100' : 'opacity-30 hover:opacity-100 active:opacity-100';
    return (
      <div {...{ [FEEDBACK_ATTR]: '' }} className="pointer-events-none fixed inset-0 z-[200]">
        <button
          type="button"
          data-testid="dev-feedback-handle"
          aria-label={
            steps.length > 0 ? t('devFeedback.flow.resume', { n: steps.length }) : t('devFeedback.open')
          }
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          style={{ top: `${handleTop}%` }}
          className={`pointer-events-auto absolute right-0 flex h-24 w-5 -translate-y-1/2 touch-none items-center justify-end ${handleFade}`}
        >
          <span className="h-16 w-1.5 rounded-l-full bg-primary" />
        </button>
        {/* Progress while folded away. Beside the handle, so it stays in the
            corner of the eye the whole time the app is being used. */}
        {steps.length > 0 ? (
          <div
            data-testid="dev-feedback-progress"
            style={{ top: `${handleTop}%` }}
            className="pointer-events-none absolute right-3 -translate-y-1/2 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium text-card-foreground shadow-lg"
          >
            {t('devFeedback.flow.progress', { screens: steps.length, marks: marks.length })}
          </div>
        ) : null}
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
        style={{ cursor: hover !== null ? 'pointer' : 'crosshair' }}
        onPointerDown={onDrawDown}
        onPointerMove={onDrawMove}
        onPointerUp={onDrawUp}
        onPointerCancel={onDrawUp}
        onPointerLeave={() => setHover(null)}
      >
        {/* Strokes — **this screen's only**. An earlier screen's are already
            baked into their own picture, and their coordinates belong to that
            viewport, so drawing them here would be graffiti. */}
        {[...marks.flatMap((m) => partsOnScreen(m, screen).map((p) => p.shape)), draft].map((shape, si) =>
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
        {/* Badges — every mark in a group wears **the same number**. Three ①
            on screen mean those three are one story, and any of them opens the
            same memo. */}
        {marks.map((m, i) =>
          partsOnScreen(m, screen).map((part, pi) => {
            const c = badgeCenter(part.bounds);
            const active = hover?.id === m.id || editingId === m.id;
            return (
              <g key={`badge-${m.id}-${pi}`}>
                {/* The tell that it can be reopened. Lit for the whole group, so
                    which strokes are one family is visible too. */}
                {active ? <circle cx={c.x} cy={c.y} r={BADGE_RADIUS + 4} fill={MARK_COLOR} opacity={0.25} /> : null}
                {/* A pin has no stroke, so only its badge shows — the ring around
                    it says "this one point". */}
                {part.kind === 'pin' ? (
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
                {/* A dot on the first badge's shoulder when a drawing is
                    attached. One drawing per group, so it is not repeated. */}
                {m.sketch && pi === 0 ? (
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
          }),
        )}
      </svg>

      {/* Preview over a badge — check what a mark says without opening it. */}
      {preview && !sending ? (
        <div
          style={{ top: preview.top, left: preview.left, maxWidth: preview.maxWidth }}
          className="pointer-events-none absolute rounded-md bg-foreground px-2 py-1 text-[11px] text-background shadow-lg"
        >
          {preview.text}
        </div>
      ) : null}

      {/* The toolbar. A full-width bar would make that whole strip un-markable,
          so it is a centred pill with the sides left clear for the canvas; if
          the pill covers the thing you need to point at, flip it.
          It goes entirely while the sketch pad or the review panel is up (hidden
          but present, its buttons would still take tab focus) and while a screen
          is being photographed. */}
      {sketching || reviewOpen || sending ? null : (
        <div className={`pointer-events-none absolute inset-x-0 ${barSide} flex flex-col items-center gap-1 p-2`}>
          {dock === 'bottom' ? (
            <>
              {hintLine}
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
            {/* One button where there used to be two ("list" and "flow"). They
                split the job: the list showed the memos but could only *open* an
                item, and an item on an earlier screen had nowhere for its memo
                box to stand; the flow showed screens with neither memo nor
                drawing. Reviewing and fixing are the same act, so they are the
                same panel. Nothing collected and nothing drawn means there is
                nothing to review. */}
            <button
              type="button"
              data-testid="dev-feedback-review-open"
              className={btn}
              disabled={steps.length === 0 && marks.length === 0}
              onClick={() => {
                setReviewOpen(true);
                setEditingId(null);
                setMergeIds(null);
                setHover(null);
              }}
            >
              {t('devFeedback.review.title')}
            </button>
            <button
              type="button"
              data-testid="dev-feedback-undo"
              className={btn}
              disabled={marks.length === 0}
              onClick={undoLastPart}
            >
              {t('devFeedback.undo')}
            </button>
            {/*
              "Next screen" — freeze this screen as a picture and fold away.
              Use the app, reopen the handle, and the screen you are on then is
              the next step. This button is the moment of freezing before
              leaving, which is what keeps coordinates from leaking across.
            */}
            <button
              type="button"
              data-testid="dev-feedback-next-screen"
              className={btn}
              disabled={sending}
              onClick={nextScreen}
            >
              {t('devFeedback.nextScreen')}
            </button>
            <button type="button" data-testid="dev-feedback-close" className={btn} onClick={close}>
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
              {hintLine}
            </>
          ) : null}
        </div>
      )}

      {/* The memo box for a group. Struck behind the sketch pad and the review
          panel, and while a screen is being photographed. */}
      {editing && bubble && !sketching && !reviewOpen && !sending ? (
        <div
          style={{ top: bubble.top, left: bubble.left, width: bubble.width }}
          className="absolute rounded-lg border border-border bg-card p-2.5 text-card-foreground shadow-lg"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: MARK_COLOR }}>
              {markLabel(marks.findIndex((m) => m.id === editing.id))}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {whereOf(editing)}
              {editing.parts.length > 1
                ? ` · ${t('devFeedback.group.parts', { n: editing.parts.length })}`
                : ''}
              {/* Marks of this group on other screens are invisible from here;
                  unsaid, "split" and "delete" would act on more than is shown. */}
              {screenSpan(editing) > 1
                ? ` · ${t('devFeedback.group.screens', { n: screenSpan(editing) })}`
                : ''}
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
          {/* The one rule this tool adds. Anywhere but inside the box the user
              is already looking at, nobody reads it. */}
          <p className="mt-1 text-[11px] text-muted-foreground">{t('devFeedback.group.hint')}</p>
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
            {/* The way back out of a wrong grouping. With grouping but no
                splitting, a mistake costs the user everything they drew. */}
            {editing.parts.length > 1 ? (
              <button
                type="button"
                data-testid="dev-feedback-split"
                className={btn}
                onClick={() => {
                  setMarks((prev) => splitMark(prev, editing.id, () => nextId.current++));
                  setEditingId(null);
                }}
              >
                {t('devFeedback.group.split')}
              </button>
            ) : null}
            <span className="flex-1" />
            <button
              type="button"
              className={btn}
              onClick={() => {
                setMarks((prev) => removeMark(prev, editing.id));
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

      {/* Review — same slot as the sketch pad (both cover drawing). It stays
          open behind the pad, so finishing a drawing comes back to the list the
          user opened it from rather than dropping them onto the canvas. */}
      {reviewOpen && !sketching ? (
        <ReviewModal
          screens={reviewList}
          shots={shots}
          notice={notice}
          mergeIds={mergeIds}
          onMemo={(id, memo) => setMarks((prev) => setMemo(prev, id, memo))}
          onRemoveMark={(id) => {
            setMarks((prev) => removeMark(prev, id));
            if (editingId === id) setEditingId(null);
          }}
          onRemoveHere={(id, sc) => {
            const next = removePartsOnScreen(marks, id, sc);
            setMarks(next);
            // It can take the whole item, when that screen held its last marks.
            if (!next.some((m) => m.id === id)) {
              if (editingId === id) setEditingId(null);
              say(t('devFeedback.review.droppedLast'));
            }
          }}
          onContinue={(id) => {
            // Pick the group and fold the panel: the next mark drawn joins it.
            setEditingId(id);
            setReviewOpen(false);
          }}
          onSketch={setSketchFor}
          onMoveStep={(index, delta) => setSteps((prev) => moveStep(prev, index, delta))}
          onRemoveStep={(index) => {
            const next = removeStep(steps, marks, index);
            setSteps(next.steps);
            setMarks(next.marks);
            const gone = steps[index];
            if (gone) forgetShot(gone.seq);
            // Items disappear with the screen, so this is never passed over in
            // silence — and the panel draws it in its own header, because the
            // hint slot under the toolbar is covered from here.
            const lost = marks.length - next.marks.length;
            say(
              lost > 0
                ? t('devFeedback.flow.removedWithMarks', { n: lost })
                : t('devFeedback.flow.removed'),
            );
          }}
          onMergeStart={() => {
            setMergeIds([]);
            setEditingId(null);
          }}
          onMergeToggle={(id) =>
            setMergeIds((prev) =>
              prev === null ? [id] : prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
            )
          }
          onMergeApply={applyMerge}
          onMergeCancel={() => setMergeIds(null)}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

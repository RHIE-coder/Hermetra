// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { FeedbackOverlay } from './feedback-overlay';

/**
 * Two rules carry this tool's whole interaction model, and neither can be
 * inferred from the pure logic:
 *   - the gesture rule (tap pins, tap-on-badge reopens, drag draws)
 *   - the grouping rule (an open memo box collects whatever is drawn next)
 * plus the flow: freezing a screen before leaving it, and never drawing an
 * earlier screen's marks on this one.
 *
 * Boundary: `window.bridge` is stubbed per test — the overlay must never reach
 * a real IPC channel. `elementsFromPoint` is stubbed because happy-dom has no
 * layout engine; in Chromium it is what turns a coordinate into an element.
 */

const invoke = vi.fn();

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'dev:feedback:step') return { ok: true, draft: '_draft-20260810-090000-bridge-bus' };
    if (channel === 'dev:feedback:save') return { ok: true, saved: '.harness/feedback/20260810-090000-bridge-bus' };
    if (channel === 'dev:feedback:shot') return { dataUrl: 'data:image/png;base64,AA' };
    return { ok: true };
  });
  window.bridge = { invoke, on: () => () => {}, channels: {}, platform: 'darwin' } as never;
  document.elementsFromPoint = () => [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.location.hash = '#/bridge/bus';
});

const setup = () => render(
  <I18nProvider>
    <FeedbackOverlay />
  </I18nProvider>,
);

/** A tap: down and up at the same point, under the drag threshold. */
const tap = (el: Element, x: number, y: number) => {
  fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' });
  fireEvent.pointerUp(el, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' });
};

/** A drag: down, a move well past the threshold, then up. */
const drag = (el: Element, from: [number, number], to: [number, number]) => {
  fireEvent.pointerDown(el, { clientX: from[0], clientY: from[1], pointerId: 1, pointerType: 'mouse' });
  fireEvent.pointerMove(el, { clientX: to[0], clientY: to[1], pointerId: 1, pointerType: 'mouse' });
  fireEvent.pointerUp(el, { clientX: to[0], clientY: to[1], pointerId: 1, pointerType: 'mouse' });
};

const openOverlay = () => {
  const handle = screen.getByTestId('dev-feedback-handle');
  fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: 400, pointerId: 1 });
  return screen.getByTestId('dev-feedback-canvas');
};

const badges = (canvas: Element) => canvas.querySelectorAll('text');
const badgeLabels = (canvas: Element) => [...badges(canvas)].map((b) => b.textContent);
const callsOn = (channel: string) => invoke.mock.calls.filter((c) => c[0] === channel);

/** Opens the one panel where a collected round is looked at and fixed. */
const openReview = () => {
  fireEvent.click(screen.getByTestId('dev-feedback-review-open'));
  return screen.getByTestId('dev-feedback-review');
};

/** The panel covers the toolbar, so "send" is only reachable once it is folded. */
const closeReview = () => fireEvent.click(screen.getByTestId('dev-feedback-review-close'));

/**
 * Freezes the current screen and comes back with the overlay open again — the
 * shape of every multi-screen case here.
 */
const goToNextScreen = async () => {
  fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));
  await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());
  return openOverlay();
};

describe('FeedbackOverlay — marking', () => {
  it('opens from the edge handle', () => {
    setup();
    expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull();
    openOverlay();
    expect(screen.getByTestId('dev-feedback-canvas')).toBeTruthy();
  });

  // The policy this replaced forced you to circle a thing to mark it, which
  // meant pointing at a button required a ring wide enough to catch its wrapper.
  it('a tap on empty space adds one mark and opens its note', () => {
    setup();
    const canvas = openOverlay();

    tap(canvas, 300, 300);

    expect(badges(canvas)).toHaveLength(1);
    expect(screen.getByTestId('dev-feedback-memo')).toBeTruthy();
  });

  it('a tap on a badge reopens that note instead of adding a mark', () => {
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('dev-feedback-memo')).toBeNull();

    tap(canvas, 300, 300);

    expect(badges(canvas)).toHaveLength(1);
    expect(screen.getByTestId('dev-feedback-memo')).toBeTruthy();
  });

  it('a drag draws a stroke and marks the area it covers', () => {
    setup();
    const canvas = openOverlay();

    drag(canvas, [100, 100], [260, 180]);

    expect(badges(canvas)).toHaveLength(1);
    expect(canvas.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  // 6-12px is neither a tap nor a stroke. Dropping it would make that band a
  // dead zone where nothing at all happens.
  it('a drag too short to be a stroke still leaves a pin', () => {
    setup();
    const canvas = openOverlay();

    drag(canvas, [100, 100], [108, 100]);

    expect(badges(canvas)).toHaveLength(1);
    expect(canvas.querySelectorAll('path')).toHaveLength(0);
  });
});

describe('FeedbackOverlay — one memo over several marks', () => {
  // "Move this card into that list" is an arrow, a box and a pin saying one
  // thing. Asked for a memo each, the user writes the same sentence three times.
  it('marks drawn while the memo box is open all join it and wear its number', () => {
    setup();
    const canvas = openOverlay();

    tap(canvas, 100, 100); // opens the memo box
    drag(canvas, [200, 200], [320, 260]);
    tap(canvas, 400, 400);

    expect(badgeLabels(canvas)).toEqual(['①', '①', '①']);
    expect(screen.getByTestId('dev-feedback-memo')).toBeTruthy();
  });

  it('closing the memo box starts a new group for the next mark', () => {
    setup();
    const canvas = openOverlay();

    tap(canvas, 100, 100);
    fireEvent.keyDown(window, { key: 'Escape' });
    tap(canvas, 400, 400);

    expect(badgeLabels(canvas)).toEqual(['①', '②']);
  });

  // A crooked box should not cost the user the sentence they just typed.
  it('undo takes one mark, not the group and its memo', () => {
    setup();
    const canvas = openOverlay();
    tap(canvas, 100, 100);
    fireEvent.change(screen.getByTestId('dev-feedback-memo'), { target: { value: '한 요청' } });
    drag(canvas, [200, 200], [320, 260]);

    fireEvent.click(screen.getByTestId('dev-feedback-undo'));

    expect(badges(canvas)).toHaveLength(1);
    expect(screen.getByTestId('dev-feedback-memo')).toHaveValue('한 요청');
  });

  it('splitting a group gives every mark its own, the memo staying with the first', () => {
    setup();
    const canvas = openOverlay();
    tap(canvas, 100, 100);
    fireEvent.change(screen.getByTestId('dev-feedback-memo'), { target: { value: '한 요청' } });
    tap(canvas, 400, 400);

    fireEvent.click(screen.getByTestId('dev-feedback-split'));

    expect(badgeLabels(canvas)).toEqual(['①', '②']);
  });
});

describe('FeedbackOverlay — a flow across screens', () => {
  // Photographing once at send time means that the moment the user navigates,
  // the previous screen's coordinates start pointing at unrelated places here.
  // That failure is exactly what freezing before leaving removes.
  it('"next screen" freezes the screen and folds the overlay away', async () => {
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);

    fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));

    await waitFor(() => expect(callsOn('dev:feedback:step')).toHaveLength(1));
    expect(callsOn('dev:feedback:step')[0][1]).toMatchObject({ draft: null, seq: 1, route: '/bridge/bus' });
    await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());
    // Folded away, not discarded — the round is still there to come back to.
    expect(screen.getByTestId('dev-feedback-progress')).toBeTruthy();
  });

  it('does not draw an earlier screen’s marks on the next one', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));
    await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());

    const second = openOverlay();

    expect(badges(second)).toHaveLength(0);
  });

  it('keeps one number across screens for a group that spans them', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    const second = await goToNextScreen();

    // Carry the same group on from the review panel, then draw on the new screen.
    openReview();
    fireEvent.click(screen.getByTestId('dev-feedback-review-continue'));
    tap(second, 500, 500);

    expect(badgeLabels(second)).toEqual(['①']);
    expect(screen.getByTestId('dev-feedback-memo')).toBeTruthy();
  });

  // Carried on here, the group has no mark on this screen, so its memo box has
  // nothing to hang off and does not appear. Without a word, "draw more" looks
  // like it did nothing — and the user gives up on the one path that carries a
  // message across screens.
  it('says which group is being carried on when it has no mark on this screen yet', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    const second = await goToNextScreen();

    openReview();
    fireEvent.click(screen.getByTestId('dev-feedback-review-continue'));

    expect(screen.getByTestId('dev-feedback-hint').textContent).toContain('①');
    // And it steps aside once there is a mark here to hang the memo box on.
    tap(second, 500, 500);
    expect(screen.getByTestId('dev-feedback-memo')).toBeTruthy();
    expect(screen.queryByTestId('dev-feedback-hint')?.textContent ?? '').not.toContain('①');
  });

  it('sends the flow in list order with every mark tagged by step', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));
    await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());

    window.location.hash = '#/mobile/devices';
    const second = openOverlay();
    tap(second, 500, 500);
    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(callsOn('dev:feedback:save')).toHaveLength(1));
    const payload = callsOn('dev:feedback:save')[0][1];
    expect(payload.draft).toBe('_draft-20260810-090000-bridge-bus');
    expect(payload.seqs).toEqual([1, 2]);
    expect(payload.steps.map((s: { route: string }) => s.route)).toEqual([
      '/bridge/bus',
      '/mobile/devices',
    ]);
    expect(payload.marks.map((m: { parts: { step: number }[] }) => m.parts[0].step)).toEqual([1, 2]);
  });

  // Coming to a screen and sending without marking it is common; an empty
  // screen on the end reads as the story ending somewhere it did not.
  it('does not append the current screen when nothing was drawn on it', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));
    await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());

    openOverlay();
    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(callsOn('dev:feedback:save')).toHaveLength(1));
    expect(callsOn('dev:feedback:step')).toHaveLength(1);
    expect(callsOn('dev:feedback:save')[0][1].seqs).toEqual([1]);
  });

  it('throws the draft away when the round is closed', async () => {
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);
    fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));
    await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());

    openOverlay();
    fireEvent.click(screen.getByTestId('dev-feedback-close'));

    await waitFor(() => expect(callsOn('dev:feedback:discard')).toHaveLength(1));
    expect(callsOn('dev:feedback:discard')[0][1]).toEqual({ draft: '_draft-20260810-090000-bridge-bus' });
  });
});

/**
 * The panel exists because of one failure: an item drawn on an earlier screen
 * could be neither edited nor deleted. The memo box hangs off a mark, and there
 * is no mark from that screen on this glass — so the only way to remove one item
 * was to drop the whole screen, which took every other item on it too and left
 * the user redrawing from memory.
 */
describe('FeedbackOverlay — reviewing an earlier screen', () => {
  it('fixes the memo of an item left on an earlier screen, in place', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    fireEvent.change(screen.getByTestId('dev-feedback-memo'), { target: { value: '정렬이 깨짐' } });
    await goToNextScreen();

    openReview();
    const memo = screen.getByTestId('dev-feedback-review-memo');
    expect(memo).toHaveValue('정렬이 깨짐');
    fireEvent.change(memo, { target: { value: '정렬이 깨짐 — 두 번째 줄부터' } });

    closeReview();
    fireEvent.click(screen.getByTestId('dev-feedback-send'));
    await waitFor(() => expect(callsOn('dev:feedback:save')).toHaveLength(1));
    expect(callsOn('dev:feedback:save')[0][1].marks[0].memo).toBe('정렬이 깨짐 — 두 번째 줄부터');
  });

  it('removes just that item, leaving the rest of the screen alone', async () => {
    setup();
    const first = openOverlay();
    tap(first, 100, 100);
    fireEvent.keyDown(window, { key: 'Escape' });
    tap(first, 400, 400);
    fireEvent.change(screen.getByTestId('dev-feedback-memo'), { target: { value: '남아야 함' } });
    await goToNextScreen();

    openReview();
    // ① of the two items on step 1 — the screen itself is untouched.
    fireEvent.click(screen.getAllByTestId('dev-feedback-review-remove')[0]);

    expect(screen.getAllByTestId('dev-feedback-review-memo')).toHaveLength(1);
    closeReview();
    fireEvent.click(screen.getByTestId('dev-feedback-send'));
    await waitFor(() => expect(callsOn('dev:feedback:save')).toHaveLength(1));
    const payload = callsOn('dev:feedback:save')[0][1];
    expect(payload.marks).toHaveLength(1);
    expect(payload.marks[0].memo).toBe('남아야 함');
    // The screen it was on is still in the flow.
    expect(payload.seqs).toEqual([1]);
  });

  // The smallest unit for an earlier screen. A single mark cannot be picked
  // there — its coordinates are in that screen's viewport — but one screen's
  // share of a request can, and the other screen keeps its marks and its memo.
  it('drops one screen’s share of an item that spans screens', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    fireEvent.change(screen.getByTestId('dev-feedback-memo'), { target: { value: '한 요청' } });
    const second = await goToNextScreen();
    openReview();
    fireEvent.click(screen.getByTestId('dev-feedback-review-continue'));
    tap(second, 500, 500);

    // Two rows now — the same item under each screen it reaches.
    openReview();
    expect(screen.getAllByTestId('dev-feedback-review-memo')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('dev-feedback-review-drop-here')[0]);

    // One row left, and the memo survived with it.
    const left = screen.getAllByTestId('dev-feedback-review-memo');
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveValue('한 요청');
    closeReview();
    fireEvent.click(screen.getByTestId('dev-feedback-send'));
    await waitFor(() => expect(callsOn('dev:feedback:save')).toHaveLength(1));
    const payload = callsOn('dev:feedback:save')[0][1];
    expect(payload.marks[0].parts).toHaveLength(1);
    expect(payload.marks[0].memo).toBe('한 요청');
  });

  // Only on an item that spans screens: on a single-screen one it would be the
  // same act as "remove", worded differently.
  it('offers the per-screen drop only where it differs from removing the item', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    await goToNextScreen();

    openReview();
    expect(screen.queryByTestId('dev-feedback-review-drop-here')).toBeNull();
  });

  // Dropping a screen still takes its items, and the panel covers the toolbar —
  // so the notice has to be drawn in the panel's own header or it is announced
  // into a covered spot.
  it('says in the panel itself that dropping a screen took items with it', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    await goToNextScreen();

    openReview();
    fireEvent.click(screen.getByTestId('dev-feedback-step-drop'));

    expect(screen.getByTestId('dev-feedback-review-notice').textContent).toContain('1');
  });

  // Capture numbers are reused once a screen is dropped, so a thumbnail kept
  // past its screen would sit under a different one — the dropped screen's
  // photograph presented as the live screen.
  it('does not carry a dropped screen’s picture over to the one that reuses its number', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    await goToNextScreen();

    openReview();
    const list = () => screen.getByTestId('dev-feedback-review-list');
    await waitFor(() => expect(list().querySelectorAll('img')).toHaveLength(1));

    fireEvent.click(screen.getByTestId('dev-feedback-step-drop'));

    // Only the screen in hand is left, and it is not wearing that picture.
    expect(list().querySelectorAll('img')).toHaveLength(0);
  });

  // The screen in hand has no picture and is not in the flow yet, but it must
  // stand: without its row, what was just drawn has nowhere to be edited from.
  it('stands the screen in hand last, without order handles', () => {
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);

    openReview();

    expect(screen.getAllByTestId('dev-feedback-review-memo')).toHaveLength(1);
    // Nothing frozen, so nothing to move or drop.
    expect(screen.queryByTestId('dev-feedback-step-drop')).toBeNull();
  });

  // Nothing collected and nothing drawn means there is nothing to review.
  it('locks the panel until there is something in it', () => {
    setup();
    openOverlay();
    expect(screen.getByTestId('dev-feedback-review-open')).toBeDisabled();
  });

  // Escape means "stop picking", not "close the list I am picking from".
  it('takes the merge picking down before the panel', () => {
    setup();
    const canvas = openOverlay();
    tap(canvas, 100, 100);
    fireEvent.keyDown(window, { key: 'Escape' });
    tap(canvas, 400, 400);
    fireEvent.keyDown(window, { key: 'Escape' });
    openReview();
    fireEvent.click(screen.getByTestId('dev-feedback-merge-start'));
    expect(screen.getAllByTestId('dev-feedback-merge-pick')).toHaveLength(2);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTestId('dev-feedback-review')).toBeTruthy();
    expect(screen.queryByTestId('dev-feedback-merge-pick')).toBeNull();
  });
});

describe('FeedbackOverlay — sending', () => {
  it('sends the route, the theme and one entry per group', async () => {
    document.documentElement.dataset.theme = 'dark';
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);
    fireEvent.change(screen.getByTestId('dev-feedback-memo'), { target: { value: '여기가 잘림' } });
    fireEvent.keyDown(screen.getByTestId('dev-feedback-memo'), { key: 'Enter' });

    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(callsOn('dev:feedback:save')).toHaveLength(1));
    const payload = callsOn('dev:feedback:save')[0][1];
    expect(payload.steps[0]).toMatchObject({ route: '/bridge/bus', theme: 'dark', hasImage: true });
    expect(payload.marks).toHaveLength(1);
    expect(payload.marks[0]).toMatchObject({ memo: '여기가 잘림', sketch: null });
    expect(payload.marks[0].parts[0]).toMatchObject({ kind: 'pin', step: 1 });
  });

  // The main process photographs the real window, so the overlay's own toolbar
  // has to be off the glass before the shot — not merely styled away.
  it('takes its own toolbar down before the screenshot is taken', async () => {
    let toolbarWhileCapturing: boolean | null = null;
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'dev:feedback:step') {
        toolbarWhileCapturing = screen.queryByTestId('dev-feedback-send') !== null;
        return { ok: true, draft: '_draft-20260810-090000-bridge-bus' };
      }
      return { ok: true, saved: '.harness/feedback/x' };
    });
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);

    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(callsOn('dev:feedback:step')).toHaveLength(1));
    expect(toolbarWhileCapturing).toBe(false);
  });

  // Send freezes the current screen first, so by the time the save fails that
  // screen is already a picture in the draft and its marks are baked into it —
  // which is why nothing is drawn any more. What must survive is the round
  // itself, so pressing send again finishes it.
  it('keeps the collected round when saving fails, ready to send again', async () => {
    invoke.mockImplementation(async (channel: string) =>
      channel === 'dev:feedback:step'
        ? { ok: true, draft: '_draft-20260810-090000-bridge-bus' }
        : { ok: false, error: '표시가 하나도 없습니다' },
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);

    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(await screen.findByTestId('dev-feedback-canvas')).toBeTruthy();
    // The screen it froze is still collected, and the mark is still counted.
    expect(screen.getByTestId('dev-feedback-review-open')).toBeEnabled();
    expect(screen.getByTestId('dev-feedback-send').textContent).toMatch(/1$/);
    consoleError.mockRestore();
  });
});

/**
 * The title bar is the window's drag region, and a drag region swallows the
 * mouse for anything drawn over it that has not opted out — which is how the
 * top-docked toolbar's buttons came to be dead. Only the opt-out is assertable
 * here: `-webkit-app-region` is resolved by the window, not by the page, so no
 * headless test can press the button and watch it fail.
 */
describe('FeedbackOverlay — the window drag region', () => {
  const root = () => document.querySelector('[data-hermetra-feedback]') as HTMLElement;

  it('opts the whole overlay out while it is open', () => {
    setup();
    openOverlay();
    expect(root().classList.contains('no-drag')).toBe(true);
  });

  it('opts the handle out but leaves the title bar draggable when folded away', () => {
    setup();
    // Parked high, the handle itself reaches into the bar.
    expect(screen.getByTestId('dev-feedback-handle').classList.contains('no-drag')).toBe(true);
    // The full-screen layer must not subtract the bar while nothing is open,
    // or the window stops being movable for the rest of the session.
    expect(root().classList.contains('no-drag')).toBe(false);
  });
});

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
    fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));
    await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());

    // Reopen the same group from the list, then draw again on the new screen.
    const second = openOverlay();
    fireEvent.click(screen.getByTestId('dev-feedback-list-toggle'));
    fireEvent.click(screen.getByTestId('dev-feedback-list').querySelector('button')!);
    tap(second, 500, 500);

    expect(badgeLabels(second)).toEqual(['①']);
    expect(screen.getByTestId('dev-feedback-memo')).toBeTruthy();
  });

  // Reopened here, the group has no mark on this screen, so its memo box has
  // nothing to hang off and does not appear. Without a word, the list tap looks
  // like it did nothing — and the user gives up on the one path that carries a
  // message across screens.
  it('says which group is being carried on when it has no mark on this screen yet', async () => {
    setup();
    const first = openOverlay();
    tap(first, 300, 300);
    fireEvent.click(screen.getByTestId('dev-feedback-next-screen'));
    await waitFor(() => expect(screen.queryByTestId('dev-feedback-canvas')).toBeNull());

    const second = openOverlay();
    fireEvent.click(screen.getByTestId('dev-feedback-list-toggle'));
    fireEvent.click(screen.getByTestId('dev-feedback-list').querySelector('button')!);

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
    expect(screen.getByTestId('dev-feedback-flow-open')).toBeTruthy();
    expect(screen.getByTestId('dev-feedback-send').textContent).toMatch(/1$/);
    consoleError.mockRestore();
  });
});

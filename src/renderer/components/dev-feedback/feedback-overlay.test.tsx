// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { FeedbackOverlay } from './feedback-overlay';

/**
 * The gesture rule is the whole interaction model of this tool, and it is the
 * one thing a reader cannot infer from the pure logic: a tap on empty space
 * pins, a tap on a badge reopens, a drag draws. Everything else here (badge
 * geometry, payload validation, note.md) is pinned by the unit tests.
 *
 * Boundary: `window.bridge` is stubbed per test — the overlay must never reach
 * a real IPC channel. `elementsFromPoint` is stubbed because happy-dom has no
 * layout engine; in Chromium it is what turns a coordinate into an element.
 */

const invoke = vi.fn();

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ ok: true, saved: '.harness/feedback/20260802-143207-bridge-bus' });
  window.bridge = { invoke, on: () => () => {}, channels: {}, platform: 'darwin' } as never;
  document.elementsFromPoint = () => [];
  window.localStorage.clear();
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
    // Close the note; the badge sits at the pin, one radius in from the corner.
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

describe('FeedbackOverlay — sending', () => {
  it('sends the route, the theme and one entry per mark', async () => {
    document.documentElement.dataset.theme = 'dark';
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);
    fireEvent.change(screen.getByTestId('dev-feedback-memo'), { target: { value: '여기가 잘림' } });
    fireEvent.keyDown(screen.getByTestId('dev-feedback-memo'), { key: 'Enter' });

    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const [channel, payload] = invoke.mock.calls[0];
    expect(channel).toBe('dev:feedback:save');
    expect(payload.route).toBe('/bridge/bus');
    expect(payload.theme).toBe('dark');
    expect(payload.marks).toHaveLength(1);
    expect(payload.marks[0]).toMatchObject({ kind: 'pin', memo: '여기가 잘림', sketch: null });
  });

  // The main process photographs the real window, so the overlay's own toolbar
  // has to be off the glass before the shot — not merely styled away.
  it('takes its own toolbar down before the screenshot is taken', async () => {
    let toolbarWhileCapturing: boolean | null = null;
    invoke.mockImplementation(async () => {
      toolbarWhileCapturing = screen.queryByTestId('dev-feedback-send') !== null;
      return { ok: true, saved: '.harness/feedback/x' };
    });
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);

    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(toolbarWhileCapturing).toBe(false);
  });

  it('reports a refusal from the main process instead of swallowing it', async () => {
    invoke.mockResolvedValue({ ok: false, error: '표시가 하나도 없습니다' });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setup();
    const canvas = openOverlay();
    tap(canvas, 300, 300);

    fireEvent.click(screen.getByTestId('dev-feedback-send'));

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    // The marks survive a failed send — the overlay stays open with them on it.
    expect(screen.getByTestId('dev-feedback-canvas')).toBeTruthy();
    consoleError.mockRestore();
  });
});

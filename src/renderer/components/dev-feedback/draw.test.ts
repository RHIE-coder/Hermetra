import { describe, it, expect } from 'vitest';
import { boundsOfPoints, boundsOfShape, partHit, polylinesOf, shapeContains, strokeHit, svgPath } from './draw';
import type { Shape } from './types';

/**
 * Drawing geometry. The contract this file keeps is that a shape becomes one
 * set of polylines and nothing else computes that independently — the on-screen
 * SVG and the sketch PNG both read this. If they each did their own maths, what
 * the user saw and what got saved would drift apart silently, and nobody would
 * find out until after it was sent.
 */

const shape = (over: Partial<Shape>): Shape => ({
  tool: 'pen',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  color: '#eb4e63',
  width: 3,
  ...over,
});

describe('polylinesOf — what line each tool becomes', () => {
  it('the pen is the path it travelled', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 9, y: 2 },
    ];
    expect(polylinesOf(shape({ tool: 'pen', points: pts }))).toEqual([pts]);
  });

  // One point is not a line. A grazed stroke must not produce an empty path.
  it('a single-point pen stroke has nothing to draw', () => {
    expect(polylinesOf(shape({ tool: 'pen', points: [{ x: 3, y: 3 }] }))).toEqual([]);
  });

  it('a line uses only start and end (the points in between are dropped)', () => {
    const s = shape({
      tool: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 9 },
        { x: 10, y: 10 },
      ],
    });
    expect(polylinesOf(s)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    ]);
  });

  it('a box goes round four corners and closes on the start', () => {
    const s = shape({
      tool: 'box',
      points: [
        { x: 2, y: 4 },
        { x: 12, y: 10 },
      ],
    });
    expect(polylinesOf(s)).toEqual([
      [
        { x: 2, y: 4 },
        { x: 12, y: 4 },
        { x: 12, y: 10 },
        { x: 2, y: 10 },
        { x: 2, y: 4 },
      ],
    ]);
  });

  describe('arrow', () => {
    const s = shape({
      tool: 'arrow',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });

    // Joining the head to the shaft doubles the stroke back over itself and
    // that stretch alone comes out thicker.
    it('comes out as two disconnected polylines, shaft and head', () => {
      const lines = polylinesOf(s);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]);
      expect(lines[1]).toHaveLength(3);
    });

    it('the head meets at the end point and spreads backwards', () => {
      const [, head] = polylinesOf(s);
      expect(head[1]).toEqual({ x: 100, y: 0 });
      // Drawn rightwards, so both wings sit left of the tip and split up/down.
      expect(head[0].x).toBeLessThan(100);
      expect(head[2].x).toBeLessThan(100);
      expect(Math.sign(head[0].y)).toBe(-Math.sign(head[2].y));
    });

    it('the head grows with the stroke width, so it is not swallowed by it', () => {
      const thin = polylinesOf({ ...s, width: 2 })[1][0];
      const thick = polylinesOf({ ...s, width: 8 })[1][0];
      expect(100 - thick.x).toBeGreaterThan(100 - thin.x);
    });
  });
});

describe('boundsOfShape — where the badge sits', () => {
  it('the pen is bounded by the points it passed through', () => {
    const s = shape({
      tool: 'pen',
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 5 },
      ],
    });
    expect(boundsOfShape(s)).toEqual({ x: 10, y: 5, width: 30, height: 15 });
  });

  // Measuring the shaft alone leaves the head outside the bounds, and then the
  // badge looks like it is pointing at nothing.
  it('an arrow is bounded including its head', () => {
    const s = shape({
      tool: 'arrow',
      points: [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ],
    });
    const b = boundsOfShape(s);
    expect(b.height).toBeGreaterThan(0);
    expect(b.y).toBeLessThan(50);
  });

  it('no points means zero size (NaN never leaks into a coordinate)', () => {
    expect(boundsOfPoints([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('svgPath', () => {
  it('moves to the first point and lines to the rest', () => {
    expect(
      svgPath([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe('M1 2 L3 4');
  });
});

describe('shapeContains · strokeHit — what the sketch pad eraser picks up', () => {
  const line = shape({
    tool: 'line',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  });

  it('a point on the stroke is a hit', () => {
    expect(shapeContains(line, 50, 0)).not.toBeNull();
  });

  it('past the end of the stroke is not (a segment, not an infinite line)', () => {
    expect(shapeContains(line, 200, 0)).toBeNull();
  });

  it('far away is not a hit', () => {
    expect(shapeContains(line, 50, 60)).toBeNull();
  });

  // Under "the later stroke wins", one thick stroke would make the thin one
  // beneath it permanently unerasable.
  it('overlapping strokes: the nearer one is picked, not the later one', () => {
    const strokes = [
      { id: 1, shape: shape({ tool: 'line', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], width: 2 }) },
      { id: 2, shape: shape({ tool: 'line', points: [{ x: 0, y: 20 }, { x: 100, y: 20 }], width: 6 }) },
    ];
    expect(strokeHit(strokes, 50, 1)).toBe(1);
    expect(strokeHit(strokes, 50, 19)).toBe(2);
  });

  it('nothing under the cursor is null', () => {
    expect(strokeHit([{ id: 1, shape: line }], 500, 500)).toBeNull();
  });
});

describe('partHit — the on-screen eraser takes one mark, not the message', () => {
  const stroke = (y: number, width = 3) =>
    shape({ tool: 'line', points: [{ x: 0, y }, { x: 100, y }], width });
  const part = (over: Record<string, unknown>) => ({
    shape: null,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    screen: 1,
    ...over,
  });

  it('names the group and which of its marks was touched', () => {
    const marks = [
      { id: 1, parts: [part({ shape: stroke(0) }), part({ shape: stroke(50) })] },
      { id: 2, parts: [part({ shape: stroke(200) })] },
    ];
    expect(partHit(marks, 50, 50)).toEqual({ id: 1, part: 1 });
    expect(partHit(marks, 50, 200)).toEqual({ id: 2, part: 0 });
    expect(partHit(marks, 50, 400)).toBeNull();
  });

  // A pin draws no stroke at all — its badge circle is the only thing to grab.
  it('catches a pin by its badge', () => {
    const pin = [{ id: 5, parts: [part({ bounds: { x: 100, y: 100, width: 22, height: 22 } })] }];
    expect(partHit(pin, 111, 111)).toEqual({ id: 5, part: 0 });
    expect(partHit(pin, 300, 300)).toBeNull();
  });

  it('overlapping marks: the nearer one is picked', () => {
    const marks = [
      { id: 1, parts: [part({ shape: stroke(0, 2) })] },
      { id: 2, parts: [part({ shape: stroke(20, 6) })] },
    ];
    expect(partHit(marks, 50, 1)).toEqual({ id: 1, part: 0 });
    expect(partHit(marks, 50, 19)).toEqual({ id: 2, part: 0 });
  });

  // A mark from an earlier screen is invisible here; erasing it would be
  // erasing a ghost, at coordinates belonging to another viewport.
  it('ignores marks belonging to another screen', () => {
    const marks = [{ id: 1, parts: [part({ shape: stroke(0), screen: 1 })] }];
    expect(partHit(marks, 50, 0, 1)).toEqual({ id: 1, part: 0 });
    expect(partHit(marks, 50, 0, 2)).toBeNull();
  });
});

// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { hslTripletToHex, tokenHex, UNRESOLVED } from './token-color';

describe('hslTripletToHex', () => {
  it.each([
    ['0 0% 100%', '#ffffff'],
    ['0 0% 0%', '#000000'],
    ['174 76% 25%', '#0f7067'], // --primary, teal
    ['191 9% 36%', '#546164'], // --muted-foreground
    ['352 70% 31%', '#861826'], // --danger
  ])('converts %s to %s', (triplet, hex) => {
    expect(hslTripletToHex(triplet)).toBe(hex);
  });

  it('accepts the leading whitespace getPropertyValue returns', () => {
    expect(hslTripletToHex('  0 0% 100%')).toBe('#ffffff');
  });

  it.each(['', 'red', '#fff', '0 0% 100% / 0.5', '191 9 36'])(
    'rejects %j rather than guessing',
    (bad) => {
      expect(hslTripletToHex(bad)).toBeNull();
    },
  );

  it('lands in the right hue sector across the whole wheel', () => {
    // A saturated, mid-lightness colour every 60 degrees: the dominant channel
    // tells us the sector maths did not slip.
    expect(hslTripletToHex('0 100% 50%')).toBe('#ff0000');
    expect(hslTripletToHex('60 100% 50%')).toBe('#ffff00');
    expect(hslTripletToHex('120 100% 50%')).toBe('#00ff00');
    expect(hslTripletToHex('180 100% 50%')).toBe('#00ffff');
    expect(hslTripletToHex('240 100% 50%')).toBe('#0000ff');
    expect(hslTripletToHex('300 100% 50%')).toBe('#ff00ff');
    expect(hslTripletToHex('360 100% 50%')).toBe('#ff0000');
  });
});

describe('tokenHex', () => {
  afterEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('reads a token off the document', () => {
    document.documentElement.style.setProperty('--card', '0 0% 100%');
    expect(tokenHex('card')).toBe('#ffffff');
  });

  it('falls back to an obvious grey when the token is absent', () => {
    // Silence would be worse: a wrong-but-plausible colour hides the mistake.
    expect(tokenHex('token-that-does-not-exist')).toBe(UNRESOLVED);
  });
});

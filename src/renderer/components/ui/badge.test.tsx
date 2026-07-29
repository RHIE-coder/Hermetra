// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

/**
 * Why this test exists:
 *
 * Tailwind resolves a colour-opacity modifier (`bg-danger/15`) against the
 * `opacity` scale. A step that is not on that scale — `/12`, say — compiles to
 * nothing at all: no error, no warning, the badge simply renders with a
 * transparent background and the tint is gone. It shipped that way once during
 * the teal/compact design change and was only caught by looking at a
 * screenshot, which is exactly the failure mode the immunity ledger entry
 * `design-token-fabrication` was written about.
 *
 * So: pin the contract at the class-string level, where it is cheap to check.
 * Rendering cannot catch this — happy-dom does not run Tailwind.
 */

const TINTED = ['web', 'mobile', 'bridge', 'success', 'danger'] as const;

/** Every colour-opacity modifier in a class string, e.g. `bg-danger/15` -> 15. */
function opacitySteps(classes: string): number[] {
  return [...classes.matchAll(/\b[a-z]+-[a-z][a-z0-9-]*\/(\d+)\b/g)].map((m) => Number(m[1]));
}

function classesOf(variant: (typeof TINTED)[number]): string {
  render(<Badge variant={variant} data-testid={`badge-${variant}`} />);
  return screen.getByTestId(`badge-${variant}`).className;
}

describe('Badge — tinted variants', () => {
  it.each(TINTED)('%s uses only opacity steps that exist on the Tailwind scale', (variant) => {
    const steps = opacitySteps(classesOf(variant));

    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step % 5, `/${step} is not a step Tailwind emits`).toBe(0);
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThanOrEqual(100);
    }
  });

  it.each(TINTED)('%s pairs a wash and a border with full-strength text', (variant) => {
    const classes = classesOf(variant);

    expect(classes).toContain(`bg-${variant}/`);
    expect(classes).toContain(`border-${variant}/`);
    // Text carries no opacity modifier — it is the readable half of the pair.
    expect(classes).toContain(`text-${variant}`);
    expect(classes).not.toMatch(new RegExp(`text-${variant}/\\d`));
  });
});

describe('Badge — neutral variants', () => {
  it('outline reads as a plain chip, not a tint', () => {
    render(<Badge variant="outline" data-testid="badge-outline" />);
    const classes = screen.getByTestId('badge-outline').className;

    expect(classes).toContain('bg-card');
    expect(classes).toContain('border-border');
    expect(opacitySteps(classes)).toEqual([]);
  });
});

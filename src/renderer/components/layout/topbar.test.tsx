// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { useBridgeStore } from '@/modules/bridge/store';
import { Topbar } from './topbar';

/**
 * The teal/compact design spends colour in three places only: the primary
 * action, state signals, and the module markers. The bus/event counter used to
 * be tinted permanently, which meant "0 · 0" shouted as loudly as a live bus.
 * It now stays neutral until it actually holds something.
 *
 * Boundary: Topbar reads three module stores. Only the bridge counts drive the
 * assertion here; the web/mobile stores keep their defaults (both idle).
 */

vi.mock('@/modules/workspace/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => <div data-testid="workspace-switcher" />,
}));

function seedBridge(vars: number, events: number) {
  useBridgeStore.setState({
    vars: Array.from({ length: vars }, (_, i) => ({
      key: `k${i}`,
      value: `v${i}`,
      updatedAt: 0,
      updatedBy: 'web' as const,
    })),
    events: Array.from({ length: events }, (_, i) => ({
      id: `e${i}`,
      channel: 'c',
      payload: null,
      side: 'web' as const,
      timestamp: 0,
    })),
  });
}

const renderTopbar = () =>
  render(
    <I18nProvider>
      <Topbar />
    </I18nProvider>,
  );

/** The counter is the only topbar chip whose text carries both numbers. */
const counter = () => screen.getByText(/0 ·|1 ·|· 0|· 1/).closest('div') as HTMLElement;

describe('Topbar — bus/event counter', () => {
  beforeEach(() => {
    seedBridge(0, 0);
  });

  it('stays neutral while the bus and the event log are both empty', () => {
    renderTopbar();

    const classes = counter().className;
    expect(classes).toContain('bg-card');
    expect(classes).not.toContain('bg-bridge');
  });

  it('takes the bridge tint as soon as the bus holds a value', () => {
    seedBridge(1, 0);
    renderTopbar();

    expect(counter().className).toContain('bg-bridge');
  });

  it('takes the bridge tint as soon as an event has arrived', () => {
    seedBridge(0, 1);
    renderTopbar();

    expect(counter().className).toContain('bg-bridge');
  });
});

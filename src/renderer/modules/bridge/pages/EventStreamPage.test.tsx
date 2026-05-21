// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { useBridgeStore } from '../store';
import { EventStreamPage } from './EventStreamPage';
import type { BridgeEvent } from '@shared/types/bridge';

function seedStore(
  events: BridgeEvent[],
  removeEvent = vi.fn(),
  clearEvents = vi.fn(),
) {
  useBridgeStore.setState({
    vars: [],
    events,
    scenarios: [],
    scenarioRuns: {},
    currentRunId: null,
    setVar: vi.fn(),
    removeVar: vi.fn(),
    clearBus: vi.fn(),
    emitEvent: vi.fn(),
    removeEvent,
    clearEvents,
    runScenario: vi.fn(),
    stopScenario: vi.fn(),
    saveScenario: vi.fn(),
    deleteScenario: vi.fn(),
    init: vi.fn(),
  });
  return { removeEvent, clearEvents };
}

const renderPage = () =>
  render(
    <I18nProvider>
      <EventStreamPage />
    </I18nProvider>,
  );

describe('EventStreamPage — delete event (UI component)', () => {
  it('renders a delete button on every event row', () => {
    seedStore([
      { id: 'e1', channel: 'a', side: 'web', payload: null, timestamp: Date.now() },
      { id: 'e2', channel: 'b', side: 'mobile', payload: null, timestamp: Date.now() },
    ]);

    renderPage();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole('button', { name: /delete|삭제/i })).toBeInTheDocument();
    expect(within(items[1]!).getByRole('button', { name: /delete|삭제/i })).toBeInTheDocument();
  });

  it('calls removeEvent(id) when the row trash is clicked', async () => {
    const removeEvent = vi.fn();
    seedStore(
      [{ id: 'evt-42', channel: 'login.done', side: 'web', payload: null, timestamp: Date.now() }],
      removeEvent,
    );

    renderPage();
    const btn = within(screen.getByRole('listitem')).getByRole('button', {
      name: /delete|삭제/i,
    });
    await userEvent.click(btn);

    expect(removeEvent).toHaveBeenCalledWith('evt-42');
  });

  it('clear-all button is enabled only when there are events', async () => {
    const clearEvents = vi.fn();
    const { clearEvents: handle } = seedStore([], vi.fn(), clearEvents);
    expect(handle).toBe(clearEvents);

    renderPage();
    const clearBtn = screen.getByRole('button', { name: /clear|비우기/i });
    expect(clearBtn).toBeDisabled();
  });

  it('clicking clear-all invokes clearEvents', async () => {
    const clearEvents = vi.fn();
    seedStore(
      [{ id: 'e', channel: 'c', side: 'bridge', payload: null, timestamp: Date.now() }],
      vi.fn(),
      clearEvents,
    );

    renderPage();
    const clearBtn = screen.getByRole('button', { name: /clear|비우기/i });
    expect(clearBtn).not.toBeDisabled();

    await userEvent.click(clearBtn);
    expect(clearEvents).toHaveBeenCalledOnce();
  });
});

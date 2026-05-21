// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { useBridgeStore } from '../store';
import { ScenariosPage } from './ScenariosPage';
import type { Scenario } from '@shared/types/bridge';

function seedStore(scenarios: Scenario[], deleteScenario = vi.fn()) {
  useBridgeStore.setState({
    vars: [],
    events: [],
    scenarios,
    scenarioRuns: {},
    currentRunId: null,
    setVar: vi.fn(),
    removeVar: vi.fn(),
    clearBus: vi.fn(),
    emitEvent: vi.fn(),
    removeEvent: vi.fn(),
    clearEvents: vi.fn(),
    runScenario: vi.fn(),
    stopScenario: vi.fn(),
    saveScenario: vi.fn(),
    deleteScenario,
    init: vi.fn(),
  });
  return { deleteScenario };
}

const renderPage = () =>
  render(
    <I18nProvider>
      <ScenariosPage />
    </I18nProvider>,
  );

describe('ScenariosPage — delete scenario (UI component)', () => {
  let confirmSpy: ReturnType<typeof vi.fn<typeof window.confirm>>;

  beforeEach(() => {
    confirmSpy = vi.fn<typeof window.confirm>().mockReturnValue(true);
    window.confirm = confirmSpy;
  });

  it('calls deleteScenario after the user confirms', async () => {
    const deleteScenario = vi.fn();
    seedStore(
      [
        { id: 'a', name: 'first', steps: [] },
        { id: 'b', name: 'second', steps: [] },
      ],
      deleteScenario,
    );

    renderPage();
    const labels = screen.getAllByText('first');
    const row = labels.map((el) => el.closest('div.group')).find(Boolean) as HTMLElement;
    expect(row).toBeTruthy();
    const btn = within(row).getByRole('button', { name: /delete|삭제/i });

    await userEvent.click(btn);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(deleteScenario).toHaveBeenCalledWith('a');
  });

  it('does NOT call deleteScenario when the user cancels', async () => {
    confirmSpy.mockReturnValue(false);
    const deleteScenario = vi.fn();
    seedStore([{ id: 'a', name: 'first', steps: [] }], deleteScenario);

    renderPage();
    const btn = screen.getByRole('button', { name: /delete|삭제/i });
    await userEvent.click(btn);

    expect(deleteScenario).not.toHaveBeenCalled();
  });
});

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { useBridgeStore } from '../store';
import { VariableBusPage } from './VariableBusPage';
import type { BusVar } from '@shared/types/bridge';

function seedStore(vars: BusVar[], removeVar = vi.fn()) {
  useBridgeStore.setState({
    vars,
    events: [],
    scenarios: [],
    scenarioRuns: {},
    currentRunId: null,
    setVar: vi.fn(),
    removeVar,
    clearBus: vi.fn(),
    emitEvent: vi.fn(),
    removeEvent: vi.fn(),
    clearEvents: vi.fn(),
    runScenario: vi.fn(),
    stopScenario: vi.fn(),
    saveScenario: vi.fn(),
    deleteScenario: vi.fn(),
    init: vi.fn(),
  });
  return { removeVar };
}

const renderPage = () =>
  render(
    <I18nProvider>
      <VariableBusPage />
    </I18nProvider>,
  );

describe('VariableBusPage — delete bus value (UI component)', () => {
  beforeEach(() => {
    seedStore([]);
  });

  it('renders a delete button on every bus row', () => {
    seedStore([
      { key: 'orderId', value: 'X-42', updatedAt: Date.now(), updatedBy: 'web' },
      { key: 'sessionId', value: 's-1', updatedAt: Date.now(), updatedBy: 'mobile' },
    ]);
    renderPage();

    const rows = screen.getAllByRole('row');
    // header + 2 data rows
    expect(rows).toHaveLength(3);
    // each data row has its own delete button
    expect(within(rows[1]!).getByRole('button', { name: /delete|삭제/i })).toBeInTheDocument();
    expect(within(rows[2]!).getByRole('button', { name: /delete|삭제/i })).toBeInTheDocument();
  });

  it('calls removeVar(key) when the trash icon is clicked', async () => {
    const removeVar = vi.fn();
    seedStore(
      [{ key: 'orderId', value: 'X-42', updatedAt: Date.now(), updatedBy: 'web' }],
      removeVar,
    );
    renderPage();

    const row = screen.getByText('orderId').closest('tr')!;
    const btn = within(row).getByRole('button', { name: /delete|삭제/i });

    await userEvent.click(btn);
    expect(removeVar).toHaveBeenCalledWith('orderId');
  });

  it('does not render the bus table when empty (no delete buttons)', () => {
    seedStore([]);
    renderPage();
    expect(screen.queryAllByRole('button', { name: /delete|삭제/i })).toHaveLength(0);
  });
});

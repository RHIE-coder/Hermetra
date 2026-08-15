import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/app-shell';
import { useBridgeStore } from './modules/bridge/store';
import { useWebStore } from './modules/web/store';
import { useMobileStore } from './modules/mobile/store';
import { useStudioStore } from './modules/studio/store';
import { useWorkspaceStore } from './modules/workspace/store';
import { useVariablesStore } from './modules/shared/variablesStore';

import { RemoteBrowserPage } from './modules/web/pages/RemoteBrowserPage';
import { WebCodePage } from './modules/web/pages/WebCodePage';

import { DevicesPage } from './modules/mobile/pages/DevicesPage';
import { MobileCodePage } from './modules/mobile/pages/MobileCodePage';
import { MobileInspectorPage } from './modules/mobile/pages/MobileInspectorPage';

import { ScenariosPage } from './modules/bridge/pages/ScenariosPage';
import { VariableBusPage } from './modules/bridge/pages/VariableBusPage';
import { EventStreamPage } from './modules/bridge/pages/EventStreamPage';
import { VariablesPage } from './modules/bridge/pages/VariablesPage';

import { BrowserPage } from './modules/studio/pages/BrowserPage';
import { JobsPage } from './modules/pipeline/pages/JobsPage';
import { SourcesPage } from './modules/pipeline/pages/SourcesPage';
import { IngestionPage } from './modules/pipeline/pages/IngestionPage';
import { ProcessingPage } from './modules/pipeline/pages/ProcessingPage';
import { StoragePage } from './modules/pipeline/pages/StoragePage';
import { InsightsPage } from './modules/pipeline/pages/InsightsPage';

export function App() {
  const initBridge = useBridgeStore((s) => s.init);
  const initWeb = useWebStore((s) => s.init);
  const initMobile = useMobileStore((s) => s.init);
  const initWorkspace = useWorkspaceStore((s) => s.init);
  const workspaceState = useWorkspaceStore((s) => s.state);
  const reinitVars = useVariablesStore((s) => s.init);
  const reloadWebScripts = useWebStore((s) => s.reloadScripts);
  const reloadMobileScripts = useMobileStore((s) => s.reloadScripts);
  const reloadStudioScripts = useStudioStore((s) => s.reloadScripts);

  useEffect(() => {
    initWorkspace();
    initBridge();
    initWeb();
    initMobile();
  }, [initWorkspace, initBridge, initWeb, initMobile]);

  // When the active workspace changes, reload workspace-scoped data.
  //
  // Every screen that holds workspace-scoped state belongs on this list, and a
  // screen missing from it does not look broken — it looks like the switch did
  // nothing, until some later action refetches and the old workspace's files
  // vanish mid-session. The studio's browser bench was missing here from the day
  // it moved out of the Data Pipeline service.
  const lastActiveId = useRef<string | null>(null);
  useEffect(() => {
    const id = workspaceState?.activeId ?? null;
    if (!id) return;
    if (lastActiveId.current && lastActiveId.current !== id) {
      void reinitVars();
      void reloadWebScripts();
      void reloadMobileScripts();
      void reloadStudioScripts();
      // Reload the rest by re-running module inits (no-op if already loaded).
      // The studio's sidecar and session are not workspace-scoped — one browser
      // is running, and a switch does not restart it.
      void initWeb();
      void initMobile();
      void initBridge();
    }
    lastActiveId.current = id;
  }, [
    workspaceState?.activeId,
    reinitVars,
    reloadWebScripts,
    reloadMobileScripts,
    reloadStudioScripts,
    initWeb,
    initMobile,
    initBridge,
  ]);

  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        {/* The landing screen stays Scenarios: every Data Pipeline screen is a
            shell, and booting the app onto an empty one would read as broken. */}
        <Route index element={<Navigate to="/bridge/scenarios" replace />} />
        <Route path="studio">
          <Route index element={<Navigate to="browser" replace />} />
          <Route path="browser" element={<BrowserPage />} />
        </Route>
        <Route path="pipeline">
          <Route index element={<Navigate to="jobs" replace />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route path="ingestion" element={<IngestionPage />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="storage" element={<StoragePage />} />
          <Route path="insights" element={<InsightsPage />} />
        </Route>
        <Route path="web">
          <Route index element={<Navigate to="remote" replace />} />
          <Route path="remote" element={<RemoteBrowserPage />} />
          <Route path="code" element={<WebCodePage />} />
        </Route>
        <Route path="mobile">
          <Route index element={<Navigate to="devices" replace />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="code" element={<MobileCodePage />} />
          <Route path="inspector" element={<MobileInspectorPage />} />
        </Route>
        <Route path="bridge">
          <Route index element={<Navigate to="scenarios" replace />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="bus" element={<VariableBusPage />} />
          <Route path="events" element={<EventStreamPage />} />
          <Route path="variables" element={<VariablesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

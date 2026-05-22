import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/app-shell';
import { useBridgeStore } from './modules/bridge/store';
import { useWebStore } from './modules/web/store';
import { useMobileStore } from './modules/mobile/store';
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

export function App() {
  const initBridge = useBridgeStore((s) => s.init);
  const initWeb = useWebStore((s) => s.init);
  const initMobile = useMobileStore((s) => s.init);
  const initWorkspace = useWorkspaceStore((s) => s.init);
  const workspaceState = useWorkspaceStore((s) => s.state);
  const reinitVars = useVariablesStore((s) => s.init);
  const listWebScripts = useWebStore((s) => s.listScripts);
  const listMobileScripts = useMobileStore((s) => s.listScripts);

  useEffect(() => {
    initWorkspace();
    initBridge();
    initWeb();
    initMobile();
  }, [initWorkspace, initBridge, initWeb, initMobile]);

  // When the active workspace changes, reload workspace-scoped data.
  const lastActiveId = useRef<string | null>(null);
  useEffect(() => {
    const id = workspaceState?.activeId ?? null;
    if (!id) return;
    if (lastActiveId.current && lastActiveId.current !== id) {
      void reinitVars();
      void listWebScripts();
      void listMobileScripts();
      // Reload the rest by re-running module inits (no-op if already loaded).
      void initWeb();
      void initMobile();
      void initBridge();
    }
    lastActiveId.current = id;
  }, [workspaceState?.activeId, reinitVars, listWebScripts, listMobileScripts, initWeb, initMobile, initBridge]);

  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/bridge/scenarios" replace />} />
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

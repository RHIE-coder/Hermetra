import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Crosshair } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useMobileStore } from '../store';
import type { InspectorElement } from '@shared/types/mobile';

/**
 * Walk a tree and find the smallest rect that contains (x, y).
 *
 * Used by the screenshot hit-test to pick the most specific element under the
 * cursor — the spec wording is "가장 작은 elem rect 하이라이트" (smallest rect).
 */
function findSmallestHit(nodes: InspectorElement[], x: number, y: number): InspectorElement | null {
  let best: InspectorElement | null = null;
  let bestArea = Infinity;
  const visit = (n: InspectorElement) => {
    const b = n.bounds;
    if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      const area = b.w * b.h;
      if (area < bestArea) {
        best = n;
        bestArea = area;
      }
    }
    for (const c of n.children) visit(c);
  };
  for (const root of nodes) visit(root);
  return best;
}

/** Look up an element by id anywhere in either tree. */
function findById(nodes: InspectorElement[], id: string): InspectorElement | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const c = findById(n.children, id);
    if (c) return c;
  }
  return null;
}

interface TreeProps {
  nodes: InspectorElement[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

function ElementTree({ nodes, onSelect, selectedId }: TreeProps) {
  return (
    <ul className="space-y-0.5 text-sm">
      {nodes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            data-testid={`inspector-tree-node-${n.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n.id);
            }}
            className={cn(
              'block w-full rounded-md px-2 py-1 text-left font-mono text-xs',
              'hover:bg-accent',
              selectedId === n.id && 'bg-accent text-accent-foreground',
            )}
          >
            {n.tag}
          </button>
          {n.children.length > 0 && (
            <div className="ml-3 border-l border-border pl-2">
              <ElementTree nodes={n.children} onSelect={onSelect} selectedId={selectedId} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function MobileInspectorPage() {
  const t = useT();
  const {
    appium,
    activeConnectionId,
    inspectorSession,
    inspectorScreenshot,
    nativeTree,
    webviewTree,
    selectedElementId,
    startInspectorSession,
    stopInspectorSession,
    captureInspectorScreenshot,
    startInspectorRecording,
    stopInspectorRecording,
    fetchInspectorElements,
    selectInspectorElement,
  } = useMobileStore();

  const [activeTab, setActiveTab] = useState<'native' | 'webview'>('native');
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Ref so the unmount cleanup can read the latest session state without
  // re-binding the effect (which would fire on every state change).
  const sessionActiveRef = useRef(inspectorSession.active);
  sessionActiveRef.current = inspectorSession.active;
  const stopRef = useRef(stopInspectorSession);
  stopRef.current = stopInspectorSession;

  useEffect(() => {
    return () => {
      if (sessionActiveRef.current) {
        void stopRef.current();
      }
    };
  }, []);

  const canStart = appium.isRunning && !!activeConnectionId;
  const showWarning = !canStart;

  const handleHit = (e: MouseEvent<HTMLDivElement>, commit: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = findSmallestHit(nativeTree, x, y);
    setHoverId(hit?.id ?? null);
    if (commit && hit) selectInspectorElement(hit.id);
  };

  const highlightElement = useMemo<InspectorElement | null>(() => {
    if (hoverId) return findById(nativeTree, hoverId);
    if (selectedElementId) return findById(nativeTree, selectedElementId);
    return null;
  }, [hoverId, selectedElementId, nativeTree]);

  const selectedElement = useMemo<InspectorElement | null>(() => {
    if (!selectedElementId) return null;
    return findById(nativeTree, selectedElementId) ?? findById(webviewTree, selectedElementId);
  }, [selectedElementId, nativeTree, webviewTree]);

  const badgeLabel = inspectorSession.active
    ? t('mobile.inspector.sessionConnected')
    : t('mobile.inspector.sessionDisconnected');

  return (
    <div data-testid="page-mobile-inspector" className="min-h-full p-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight">{t('mobile.inspector.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('mobile.inspector.subtitle')}</p>
        </div>
        <span
          data-testid="inspector-status-badge"
          data-session-active={String(inspectorSession.active)}
          className={cn(
            'pill text-xs',
            inspectorSession.active ? 'text-mobile' : 'text-muted-foreground',
          )}
        >
          {badgeLabel}
        </span>
      </header>

      {showWarning && (
        <div
          data-testid="inspector-warning-banner"
          className="rounded-lg border border-danger/25 bg-danger/15 px-4 py-3 text-sm text-danger"
        >
          {t('mobile.inspector.appiumNotConnected')}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!inspectorSession.active ? (
          <button
            type="button"
            data-testid="inspector-btn-start-session"
            disabled={!canStart}
            onClick={() => void startInspectorSession()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {t('mobile.inspector.startSession')}
          </button>
        ) : (
          <button
            type="button"
            data-testid="inspector-btn-stop-session"
            onClick={() => void stopInspectorSession()}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground"
          >
            {t('mobile.inspector.stopSession')}
          </button>
        )}
        <button
          type="button"
          data-testid="inspector-btn-screenshot"
          disabled={!inspectorSession.active}
          onClick={() => void captureInspectorScreenshot()}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {t('mobile.inspector.screenshot')}
        </button>
        {!inspectorSession.recording ? (
          <button
            type="button"
            data-testid="inspector-btn-start-record"
            disabled={!inspectorSession.active}
            onClick={() => void startInspectorRecording()}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {t('mobile.inspector.startRecord')}
          </button>
        ) : (
          <button
            type="button"
            data-testid="inspector-btn-stop-record"
            onClick={() => void stopInspectorRecording()}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          >
            {t('mobile.inspector.stopRecord')}
          </button>
        )}
        <button
          type="button"
          data-testid="inspector-btn-extract"
          disabled={!inspectorSession.active}
          onClick={() => void fetchInspectorElements()}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {t('mobile.inspector.extract')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: screenshot + overlay */}
        <div className="panel min-h-[320px] p-4">
          {inspectorScreenshot ? (
            <div
              data-testid="inspector-screenshot-canvas"
              className="relative inline-block"
              onMouseMove={(e) => handleHit(e, false)}
              onMouseLeave={() => setHoverId(null)}
              onClick={(e) => handleHit(e, true)}
            >
              <img src={inspectorScreenshot} alt="screenshot" className="block max-w-full" />
              {highlightElement?.bounds && (
                <div
                  data-testid="inspector-overlay-highlight"
                  data-element-id={highlightElement.id}
                  style={{
                    position: 'absolute',
                    left: highlightElement.bounds.x,
                    top: highlightElement.bounds.y,
                    width: highlightElement.bounds.w,
                    height: highlightElement.bounds.h,
                    pointerEvents: 'none',
                  }}
                  className="border-2 border-primary bg-primary/10"
                />
              )}
              {!highlightElement && selectedElementId && (
                // Overlay element still renders for AC10 even when bounds=null
                // (so the data-element-id can be asserted).
                <div
                  data-testid="inspector-overlay-highlight"
                  data-element-id={selectedElementId}
                  style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
                  className="hidden"
                />
              )}
            </div>
          ) : (
            <div
              data-testid="inspector-screenshot-empty"
              className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground"
            >
              {t('mobile.inspector.emptyScreenshot')}
            </div>
          )}
        </div>

        {/* Right: element trees */}
        <div className="panel min-h-[320px] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="inspector-tab-native"
              onClick={() => setActiveTab('native')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium',
                activeTab === 'native' ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              Native ({nativeTree.length})
            </button>
            <button
              type="button"
              data-testid="inspector-tab-webview"
              onClick={() => setActiveTab('webview')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium',
                activeTab === 'webview' ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              Webview ({webviewTree.length})
            </button>
          </div>
          <div data-testid="inspector-tree" className="panel-inset max-h-[60vh] overflow-auto p-2">
            {activeTab === 'native' ? (
              nativeTree.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  {t('mobile.inspector.emptyElements')}
                </div>
              ) : (
                <ElementTree
                  nodes={nativeTree}
                  onSelect={selectInspectorElement}
                  selectedId={selectedElementId}
                />
              )
            ) : webviewTree.length === 0 ? (
              <div
                data-testid="inspector-webview-empty"
                className="px-2 py-3 text-xs text-muted-foreground"
              >
                {t('mobile.inspector.emptyElements')}
              </div>
            ) : (
              <ElementTree
                nodes={webviewTree}
                onSelect={selectInspectorElement}
                selectedId={selectedElementId}
              />
            )}
          </div>
        </div>
      </div>

      {selectedElement ? (
        <div data-testid="inspector-detail-content" className="panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {selectedElement.tag}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
            {Object.entries(selectedElement.attributes).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div
          data-testid="inspector-detail-empty"
          className="panel p-4 text-sm text-muted-foreground"
        >
          {t('mobile.inspector.emptyDetail')}
        </div>
      )}

      <footer className="text-xs text-muted-foreground">{t('mobile.inspector.hint')}</footer>
    </div>
  );
}

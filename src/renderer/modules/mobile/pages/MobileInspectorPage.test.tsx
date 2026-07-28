// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { useMobileStore } from '../store';
import { MobileInspectorPage } from './MobileInspectorPage';
import type {
  AppiumServerStatus,
  Connection,
  InspectorElement,
  InspectorSessionState,
} from '@shared/types/mobile';

/**
 * Spec acceptance criteria (mobile-inspector-page §Acceptance criteria):
 *
 *   AC1 (UI side): Page renders at testId `page-mobile-inspector`.
 *   AC2: Header, 4 action buttons, left/right panels, bottom detail, footer hint.
 *   AC3: No 사용중 connection → 세션 시작 disabled + warning banner visible.
 *   AC4: 사용중 + Appium isRunning → 세션 시작 enabled, no warning banner.
 *   AC5: 세션 시작 → store.startInspectorSession() called → badge data-session-active="true".
 *   AC6: Session active → 스크린샷 → store.captureInspectorScreenshot() → image rendered.
 *   AC7: 녹화 시작 → 녹화 중지 toggle + stopInspectorRecording called.
 *   AC8: 요소 추출 → fetchInspectorElements() called + counts on Native/Webview tabs.
 *   AC9: Hover screenshot → outline element on the smallest matching node.
 *        Click → bottom detail panel populates with element's attributes.
 *  AC10: Tree node click → screenshot overlay reflects same selection (sync).
 *  AC11: Page unmount → store.stopInspectorSession() called automatically.
 *
 * Boundary (CLAUDE.md §3.4): mock store actions. The page test does not run
 * IPC; the driver-side mock data is exercised in tests/api/inspector.test.ts.
 *
 * Notes:
 *  - Hover hit-test (AC9) is asserted by firing a `mouseMove` event on the
 *    `inspector-screenshot-canvas` element and checking that an overlay
 *    `inspector-overlay-highlight` appears with the `data-element-id` of the
 *    smallest matching rect. Since happy-dom does not lay out the page, the
 *    implementer must make the canvas's bounds discoverable via
 *    `getBoundingClientRect` — which happy-dom returns from the inline
 *    style/width/height attributes we feed below.
 */

interface StoreSeed {
  appium?: AppiumServerStatus;
  connections?: Connection[];
  activeConnectionId?: string | null;
  inspectorSession?: InspectorSessionState;
  inspectorScreenshot?: string | null;
  inspectorVideo?: string | null;
  nativeTree?: InspectorElement[];
  webviewTree?: InspectorElement[];
  selectedElementId?: string | null;
  // Action mocks
  startInspectorSession?: () => Promise<void>;
  stopInspectorSession?: () => Promise<void>;
  captureInspectorScreenshot?: () => Promise<void>;
  startInspectorRecording?: () => Promise<void>;
  stopInspectorRecording?: () => Promise<void>;
  fetchInspectorElements?: () => Promise<void>;
  selectInspectorElement?: (id: string | null) => void;
}

function seedStore(seed: StoreSeed = {}) {
  const startInspectorSession =
    seed.startInspectorSession ?? vi.fn().mockResolvedValue(undefined);
  const stopInspectorSession =
    seed.stopInspectorSession ?? vi.fn().mockResolvedValue(undefined);
  const captureInspectorScreenshot =
    seed.captureInspectorScreenshot ?? vi.fn().mockResolvedValue(undefined);
  const startInspectorRecording =
    seed.startInspectorRecording ?? vi.fn().mockResolvedValue(undefined);
  const stopInspectorRecording =
    seed.stopInspectorRecording ?? vi.fn().mockResolvedValue(undefined);
  const fetchInspectorElements =
    seed.fetchInspectorElements ?? vi.fn().mockResolvedValue(undefined);
  const selectInspectorElement = seed.selectInspectorElement ?? vi.fn();

  useMobileStore.setState({
    tooling: { appium: true, adb: true, libimobiledevice: true },
    appium: seed.appium ?? { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
    devices: [],
    savedDevices: [],
    capabilities: [],
    activeCapabilityId: null,
    connections: seed.connections ?? [],
    activeConnectionId: seed.activeConnectionId ?? null,
    appleIdentities: [],
    session: { active: false, recording: false },
    lastScreenshot: null,
    lastTest: null,
    output: '',
    scripts: [],
    currentScript: null,
    selectedDeviceKey: null,
    installedApps: [],
    installedAppsLoading: false,
    // Inspector slots (new in this spec)
    inspectorSession:
      seed.inspectorSession ?? { active: false, recording: false, context: null },
    inspectorScreenshot: seed.inspectorScreenshot ?? null,
    inspectorVideo: seed.inspectorVideo ?? null,
    nativeTree: seed.nativeTree ?? [],
    webviewTree: seed.webviewTree ?? [],
    selectedElementId: seed.selectedElementId ?? null,
    // Existing action stubs (must remain wired so the store type stays satisfied).
    init: vi.fn().mockResolvedValue(undefined),
    refreshDevices: vi.fn().mockResolvedValue(undefined),
    refreshTooling: vi.fn().mockResolvedValue(undefined),
    refreshSavedDevices: vi.fn().mockResolvedValue(undefined),
    refreshInstalledApps: vi.fn().mockResolvedValue(undefined),
    saveDevice: vi.fn().mockResolvedValue(undefined),
    removeDevice: vi.fn().mockResolvedValue(undefined),
    updateAlias: vi.fn().mockResolvedValue(undefined),
    selectDevice: vi.fn(),
    startAppium: vi.fn().mockResolvedValue(undefined),
    stopAppium: vi.fn().mockResolvedValue(undefined),
    connectExternal: vi.fn().mockResolvedValue(undefined),
    disconnectExternal: vi.fn().mockResolvedValue(undefined),
    setActiveCapability: vi.fn(),
    saveCapability: vi.fn().mockResolvedValue(undefined),
    removeCapability: vi.fn().mockResolvedValue(undefined),
    testCapability: vi.fn().mockResolvedValue({ ok: true, message: '', durationMs: 0 }),
    refreshConnections: vi.fn().mockResolvedValue(undefined),
    saveConnection: vi.fn().mockResolvedValue(undefined),
    removeConnection: vi.fn().mockResolvedValue(undefined),
    setConnectionInUse: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue({ ok: true, durationMs: 0, message: 'ok' }),
    listAppleCerts: vi.fn().mockResolvedValue(undefined),
    startSession: vi.fn().mockResolvedValue(undefined),
    stopSession: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(null),
    runScript: vi.fn().mockResolvedValue(undefined),
    listScripts: vi.fn().mockResolvedValue(undefined),
    loadScript: vi.fn().mockResolvedValue(undefined),
    saveScript: vi.fn().mockResolvedValue(undefined),
    deleteScript: vi.fn().mockResolvedValue(undefined),
    mkdirScript: vi.fn().mockResolvedValue(undefined),
    moveScripts: vi.fn().mockResolvedValue({ ok: true }),
    setCurrentScript: vi.fn(),
    // Inspector actions (new)
    startInspectorSession,
    stopInspectorSession,
    captureInspectorScreenshot,
    startInspectorRecording,
    stopInspectorRecording,
    fetchInspectorElements,
    selectInspectorElement,
  });

  return {
    startInspectorSession,
    stopInspectorSession,
    captureInspectorScreenshot,
    startInspectorRecording,
    stopInspectorRecording,
    fetchInspectorElements,
    selectInspectorElement,
  };
}

const baseConn = (overrides: Partial<Connection> = {}): Connection => ({
  id: 'conn-1',
  name: 'Active',
  deviceId: 'ios:UDID-1',
  platform: 'ios',
  extra: {},
  ...overrides,
});

const renderPage = () =>
  render(
    <I18nProvider>
      <MobileInspectorPage />
    </I18nProvider>,
  );

/** Helper to assemble a small native tree with known bounds for hover tests. */
const sampleNativeTree = (): InspectorElement[] => [
  {
    id: 'native:0',
    tag: 'XCUIElementTypeApplication',
    attributes: { name: 'App' },
    bounds: { x: 0, y: 0, w: 100, h: 200 },
    children: [
      {
        id: 'native:0:0',
        tag: 'XCUIElementTypeButton',
        attributes: { name: 'Submit', label: 'Submit' },
        bounds: { x: 10, y: 20, w: 30, h: 40 },
        children: [],
      },
      {
        id: 'native:0:1',
        tag: 'XCUIElementTypeStaticText',
        attributes: { name: 'Hello' },
        bounds: { x: 50, y: 100, w: 40, h: 20 },
        children: [],
      },
    ],
  },
];

describe('MobileInspectorPage — AC1 / AC2 (page renders, structure)', () => {
  beforeEach(() => {
    seedStore();
  });

  // AC1: page root testId so the e2e smoke spec can navigate to it.
  it('AC1: renders root data-testid="page-mobile-inspector"', () => {
    renderPage();
    expect(screen.getByTestId('page-mobile-inspector')).toBeInTheDocument();
  });

  // AC2: 4 action buttons present (session, screenshot, record, extract).
  it('AC2: renders the 4 action buttons with stable testIds', () => {
    renderPage();
    expect(screen.getByTestId('inspector-btn-start-session')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-btn-screenshot')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-btn-start-record')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-btn-extract')).toBeInTheDocument();
  });

  // AC2: status badge in header.
  it('AC2: renders inspector-status-badge in the header with data-session-active="false" by default', () => {
    renderPage();
    const badge = screen.getByTestId('inspector-status-badge');
    expect(badge.getAttribute('data-session-active')).toBe('false');
  });

  // AC2: left panel screenshot area empty by default → empty placeholder.
  it('AC2: when no screenshot, left panel renders inspector-screenshot-empty placeholder', () => {
    renderPage();
    expect(screen.getByTestId('inspector-screenshot-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('inspector-screenshot-canvas')).not.toBeInTheDocument();
  });

  // AC2: right panel has Native and Webview tabs.
  it('AC2: renders Native + Webview tabs (inspector-tab-native, inspector-tab-webview)', () => {
    renderPage();
    expect(screen.getByTestId('inspector-tab-native')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-tab-webview')).toBeInTheDocument();
  });

  // AC2: bottom detail empty placeholder.
  it('AC2: bottom detail renders empty placeholder when nothing is selected', () => {
    renderPage();
    expect(screen.getByTestId('inspector-detail-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('inspector-detail-content')).not.toBeInTheDocument();
  });
});

describe('MobileInspectorPage — AC3 / AC4 (warning banner + start enablement)', () => {
  beforeEach(() => {
    seedStore();
  });

  // AC3: no in-use connection → start button disabled + warning banner visible.
  it('AC3: no activeConnectionId → inspector-btn-start-session is disabled', () => {
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn({ id: 'conn-1' })],
      activeConnectionId: null,
    });
    renderPage();
    const btn = screen.getByTestId('inspector-btn-start-session');
    expect(btn).toBeDisabled();
  });

  // AC3: warning banner present when Appium is not running OR no in-use conn.
  it('AC3: Appium not running → inspector-warning-banner is visible', () => {
    seedStore({
      appium: { isRunning: false, mode: null, url: 'http://127.0.0.1:4723' },
      connections: [baseConn({ id: 'conn-1' })],
      activeConnectionId: 'conn-1',
    });
    renderPage();
    expect(screen.getByTestId('inspector-warning-banner')).toBeInTheDocument();
  });

  it('AC3: no activeConnectionId → inspector-warning-banner is visible', () => {
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [],
      activeConnectionId: null,
    });
    renderPage();
    expect(screen.getByTestId('inspector-warning-banner')).toBeInTheDocument();
  });

  // AC4: in-use + isRunning → button enabled + banner gone.
  it('AC4: in-use connection + isRunning → start button enabled, no warning banner', () => {
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn({ id: 'conn-1' })],
      activeConnectionId: 'conn-1',
    });
    renderPage();
    const btn = screen.getByTestId('inspector-btn-start-session');
    expect(btn).not.toBeDisabled();
    expect(screen.queryByTestId('inspector-warning-banner')).not.toBeInTheDocument();
  });
});

describe('MobileInspectorPage — AC5 (start session)', () => {
  // AC5: clicking start calls store.startInspectorSession().
  it('AC5: clicking inspector-btn-start-session calls startInspectorSession()', async () => {
    const user = userEvent.setup();
    const startInspectorSession = vi.fn().mockResolvedValue(undefined);
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      startInspectorSession,
    });
    renderPage();

    await user.click(screen.getByTestId('inspector-btn-start-session'));
    expect(startInspectorSession).toHaveBeenCalledTimes(1);
  });

  // AC5: inspectorSession.active=true → badge updates and "stop" button appears.
  it('AC5: when inspectorSession.active=true, badge shows data-session-active="true" and stop button visible', () => {
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
    });
    renderPage();

    const badge = screen.getByTestId('inspector-status-badge');
    expect(badge.getAttribute('data-session-active')).toBe('true');
    expect(screen.getByTestId('inspector-btn-stop-session')).toBeInTheDocument();
    // The "start" variant should be gone (or hidden) once active.
    expect(screen.queryByTestId('inspector-btn-start-session')).not.toBeInTheDocument();
  });
});

describe('MobileInspectorPage — AC6 (screenshot)', () => {
  // AC6: clicking 스크린샷 calls captureInspectorScreenshot.
  it('AC6: clicking inspector-btn-screenshot calls captureInspectorScreenshot()', async () => {
    const user = userEvent.setup();
    const captureInspectorScreenshot = vi.fn().mockResolvedValue(undefined);
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      captureInspectorScreenshot,
    });
    renderPage();

    await user.click(screen.getByTestId('inspector-btn-screenshot'));
    expect(captureInspectorScreenshot).toHaveBeenCalledTimes(1);
  });

  // AC6: when inspectorScreenshot is set, image renders in the left panel.
  it('AC6: inspectorScreenshot set → inspector-screenshot-canvas renders with the image', () => {
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      inspectorScreenshot: 'data:image/png;base64,AAA',
    });
    renderPage();

    const canvas = screen.getByTestId('inspector-screenshot-canvas');
    expect(canvas).toBeInTheDocument();
    const img = within(canvas).getByRole('img') as HTMLImageElement;
    expect(img.src).toContain('data:image/png;base64,AAA');
    // Empty placeholder is gone now that we have a screenshot.
    expect(screen.queryByTestId('inspector-screenshot-empty')).not.toBeInTheDocument();
  });
});

describe('MobileInspectorPage — AC7 (recording toggle)', () => {
  // AC7: clicking "녹화 시작" calls startInspectorRecording.
  it('AC7: clicking inspector-btn-start-record calls startInspectorRecording()', async () => {
    const user = userEvent.setup();
    const startInspectorRecording = vi.fn().mockResolvedValue(undefined);
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      startInspectorRecording,
    });
    renderPage();

    await user.click(screen.getByTestId('inspector-btn-start-record'));
    expect(startInspectorRecording).toHaveBeenCalledTimes(1);
  });

  // AC7: when recording=true, the start button is replaced by the stop button.
  it('AC7: when inspectorSession.recording=true, inspector-btn-stop-record is visible', () => {
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      inspectorSession: { active: true, recording: true, context: 'NATIVE_APP' },
    });
    renderPage();

    expect(screen.getByTestId('inspector-btn-stop-record')).toBeInTheDocument();
    expect(screen.queryByTestId('inspector-btn-start-record')).not.toBeInTheDocument();
  });

  // AC7: clicking 녹화 중지 calls stopInspectorRecording.
  it('AC7: clicking inspector-btn-stop-record calls stopInspectorRecording()', async () => {
    const user = userEvent.setup();
    const stopInspectorRecording = vi.fn().mockResolvedValue(undefined);
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      inspectorSession: { active: true, recording: true, context: 'NATIVE_APP' },
      stopInspectorRecording,
    });
    renderPage();

    await user.click(screen.getByTestId('inspector-btn-stop-record'));
    expect(stopInspectorRecording).toHaveBeenCalledTimes(1);
  });
});

describe('MobileInspectorPage — AC8 (extract elements + tabs/counts)', () => {
  // AC8: clicking 요소 추출 calls fetchInspectorElements.
  it('AC8: clicking inspector-btn-extract calls fetchInspectorElements()', async () => {
    const user = userEvent.setup();
    const fetchInspectorElements = vi.fn().mockResolvedValue(undefined);
    seedStore({
      appium: { isRunning: true, mode: 'local', url: 'http://127.0.0.1:4723' },
      connections: [baseConn()],
      activeConnectionId: 'conn-1',
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      fetchInspectorElements,
    });
    renderPage();

    await user.click(screen.getByTestId('inspector-btn-extract'));
    expect(fetchInspectorElements).toHaveBeenCalledTimes(1);
  });

  // AC8: tab labels include the count of top-level elements.
  it('AC8: Native tab label includes the count of top-level native nodes', () => {
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      nativeTree: sampleNativeTree(),
    });
    renderPage();

    const tab = screen.getByTestId('inspector-tab-native');
    // The implementer must surface the count (here 1 root). Using a regex so we
    // don't pin the exact formatting ("(1)" vs " 1 " vs ".1.").
    expect(tab.textContent).toMatch(/1/);
  });

  it('AC8: Webview tab label reflects the webviewTree count', () => {
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      nativeTree: [],
      webviewTree: [
        {
          id: 'webview:0',
          tag: 'div',
          attributes: {},
          bounds: null,
          children: [],
        },
        {
          id: 'webview:1',
          tag: 'span',
          attributes: {},
          bounds: null,
          children: [],
        },
      ],
    });
    renderPage();

    const tab = screen.getByTestId('inspector-tab-webview');
    expect(tab.textContent).toMatch(/2/);
  });

  // AC8: native tree renders nodes as `inspector-tree-node-<id>`.
  it('AC8: native tree renders one inspector-tree-node-<id> per element', () => {
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      nativeTree: sampleNativeTree(),
    });
    renderPage();

    const tree = screen.getByTestId('inspector-tree');
    expect(within(tree).getByTestId('inspector-tree-node-native:0')).toBeInTheDocument();
    expect(
      within(tree).getByTestId('inspector-tree-node-native:0:0'),
    ).toBeInTheDocument();
    expect(
      within(tree).getByTestId('inspector-tree-node-native:0:1'),
    ).toBeInTheDocument();
  });
});

describe('MobileInspectorPage — AC9 (hover highlight + click select)', () => {
  // AC9: hovering the screenshot at a coordinate inside an element's rect
  // shows the overlay highlight with the matching data-element-id.
  it('AC9: mouseMove inside an element bounds → inspector-overlay-highlight with that element id', async () => {
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      inspectorScreenshot: 'data:image/png;base64,AAA',
      nativeTree: sampleNativeTree(),
    });
    renderPage();

    const canvas = screen.getByTestId('inspector-screenshot-canvas');
    // The implementer renders the screenshot at the native image size (100×200
    // per sampleNativeTree). happy-dom uses the inline width/height we set on
    // the wrapper; we feed a synthetic clientRect by setting offsetWidth/Height
    // through the DOM (jsdom does not lay out, but it does report 0). The
    // implementer must read the rect from the rendered <img> dimensions, so we
    // need at least the props to be read-through. As a compromise the test
    // assumes the coordinate space is in *image* coords (the most testable
    // contract). The implementer chooses how to convert; for the test we feed
    // raw image coords via clientX/clientY and rely on the implementer
    // documenting that the hit-test reads `clientX - rect.left`, with
    // happy-dom's rect.left being 0.

    fireEvent.mouseMove(canvas, { clientX: 25, clientY: 40 });

    const highlight = await screen.findByTestId('inspector-overlay-highlight');
    // (25, 40) is inside the Button rect {x:10, y:20, w:30, h:40} but also
    // inside the Application root {x:0, y:0, w:100, h:200}. The "smallest"
    // rule must pick the button.
    expect(highlight.getAttribute('data-element-id')).toBe('native:0:0');
  });

  // AC9: clicking the screenshot at the hovered point selects the element.
  it('AC9: clicking the screenshot calls selectInspectorElement with the hit element id', async () => {
    const selectInspectorElement = vi.fn();
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      inspectorScreenshot: 'data:image/png;base64,AAA',
      nativeTree: sampleNativeTree(),
      selectInspectorElement,
    });
    renderPage();

    const canvas = screen.getByTestId('inspector-screenshot-canvas');
    fireEvent.mouseMove(canvas, { clientX: 60, clientY: 105 });
    fireEvent.click(canvas, { clientX: 60, clientY: 105 });

    // (60, 105) lands inside StaticText {x:50, y:100, w:40, h:20}.
    expect(selectInspectorElement).toHaveBeenCalledWith('native:0:1');
  });

  // AC9: the bottom detail panel renders the selected element's attributes.
  it('AC9: selectedElementId set → inspector-detail-content renders the attributes', () => {
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      nativeTree: sampleNativeTree(),
      selectedElementId: 'native:0:0',
    });
    renderPage();

    const detail = screen.getByTestId('inspector-detail-content');
    // The selected element is the Button — its `name` attribute must surface.
    expect(detail.textContent).toMatch(/Submit/);
    // The empty placeholder must be gone.
    expect(screen.queryByTestId('inspector-detail-empty')).not.toBeInTheDocument();
  });
});

describe('MobileInspectorPage — AC10 (tree click → screenshot outline sync)', () => {
  // AC10: clicking a tree node calls selectInspectorElement, and when selectedId
  // is set, the screenshot overlay highlight reflects the same id.
  it('AC10: clicking inspector-tree-node-<id> calls selectInspectorElement(id)', async () => {
    const user = userEvent.setup();
    const selectInspectorElement = vi.fn();
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      nativeTree: sampleNativeTree(),
      selectInspectorElement,
    });
    renderPage();

    await user.click(screen.getByTestId('inspector-tree-node-native:0:0'));
    expect(selectInspectorElement).toHaveBeenCalledWith('native:0:0');
  });

  // AC10: when selectedElementId is set AND we have a screenshot, the overlay
  // highlight reflects the selection (no hover needed).
  it('AC10: selectedElementId + inspectorScreenshot → overlay highlight reflects the selected id', () => {
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      inspectorScreenshot: 'data:image/png;base64,AAA',
      nativeTree: sampleNativeTree(),
      selectedElementId: 'native:0:1',
    });
    renderPage();

    const highlight = screen.getByTestId('inspector-overlay-highlight');
    expect(highlight.getAttribute('data-element-id')).toBe('native:0:1');
  });
});

describe('MobileInspectorPage — AC11 (auto stopSession on unmount)', () => {
  // AC11: when the page is unmounted while a session is active, the cleanup
  // calls stopInspectorSession().
  it('AC11: unmounting an active session calls stopInspectorSession()', () => {
    const stopInspectorSession = vi.fn().mockResolvedValue(undefined);
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      stopInspectorSession,
    });
    const view = renderPage();
    // Cleanup the React tree.
    act(() => {
      view.unmount();
    });
    expect(stopInspectorSession).toHaveBeenCalledTimes(1);
  });

  // AC11: when the session is NOT active, unmount must NOT call stopSession
  // (avoid spurious driver invocations).
  it('AC11: unmounting an inactive session does not call stopInspectorSession()', () => {
    const stopInspectorSession = vi.fn().mockResolvedValue(undefined);
    seedStore({
      inspectorSession: { active: false, recording: false, context: null },
      stopInspectorSession,
    });
    const view = renderPage();
    act(() => {
      view.unmount();
    });
    expect(stopInspectorSession).not.toHaveBeenCalled();
  });
});

describe('MobileInspectorPage — webview empty-state guard', () => {
  // Spec §Open notes ("Webview overlay") + AC8: if there is no webview context,
  // the Webview tab body shows a "no webview" empty-state.
  it('Webview tab body shows an empty state when webviewTree is []', async () => {
    const user = userEvent.setup();
    seedStore({
      inspectorSession: { active: true, recording: false, context: 'NATIVE_APP' },
      nativeTree: sampleNativeTree(),
      webviewTree: [],
    });
    renderPage();

    await user.click(screen.getByTestId('inspector-tab-webview'));

    // Either an "empty" panel testId or a fallback message — the implementer
    // pins this; we assert the most stable id.
    await waitFor(() => {
      expect(screen.getByTestId('inspector-webview-empty')).toBeInTheDocument();
    });
  });
});

// Extra: cross-cutting `cleanup()` between groups to keep the DOM tidy.
beforeEach(() => {
  cleanup();
});

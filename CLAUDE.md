# CLAUDE.md — Hermetra working agreement

This file is the durable contract between Claude (and any AI coding agent) and this codebase. **Read it before touching code.** It says how the code is structured, which patterns to follow, and how to write & verify changes.

The companion file `AGENTS.md` defines the same rules for non-Claude agents. Keep them in sync.

---

## 0. The product, in one paragraph

Hermetra is a desktop Electron app that bridges **Web** (Playwright) and **Mobile** (Appium) automation sessions. The differentiator is the **Bridge** layer (rendered as "Settings" / "설정" in the UI): a shared variable bus, a cross-side event bus, and a scenario orchestrator that lets a single ordered scenario span both sides. See `ARCHITECTURE.md` for the long form.

> Note on naming: the UI label for the Bridge module was renamed to **"Settings" / "설정"**. Internal identifiers — routes (`/bridge/*`), IPC channel names (`BRIDGE_*`), module folder (`modules/bridge`), domain types (`BridgeEvent`, `BridgeSide`) — keep the **`bridge`** name on purpose. Don't rename them or you'll churn IPC contracts and tests.

---

## 1. Architecture in one sketch

```
Renderer (React 19 + Zustand + Tailwind)
   └─ services/  IPC wrappers (one per channel group)
   └─ modules/   web | mobile | bridge | workspace | dashboard?  (each: pages + store)
        ▲
        │ window.bridge.invoke(<channel>, <typed input>)
        ▼
Preload (contextBridge, no nodeIntegration)
        ▲
        │ ipcRenderer / ipcMain
        ▼
Main process (Electron)
   ├─ ipc/register.ts           wires channels → handlers
   ├─ services/                 storage (JSON), workspaceManager, scripts, variables, browserInstall
   ├─ drivers/web/playwright.ts (real) | drivers/mock if no driver
   ├─ drivers/mobile/appium.ts  (real) | drivers/mock if no driver
   └─ bridge/                   varBus, eventBus, orchestrator   ← THE pure-logic core
```

**Hard rule:** the renderer never imports from `main/` or `node:*`. All capability access flows through the typed IPC contract in `src/shared/ipc/channels.ts`.

---

## 2. Design patterns in use (and why)

These are the patterns already in the codebase. Use them; don't invent parallel structures.

### 2.1 Layered architecture
- **UI layer** = `src/renderer/` (React + Zustand)
- **Application layer** = `src/main/services/` and `src/main/ipc/`
- **Domain (pure) layer** = `src/main/bridge/` (VarBus, BridgeEventBus, Orchestrator) + `src/main/services/variables.ts` (data shapes)
- **Infrastructure layer** = `src/main/drivers/` (Playwright, Appium adapters, mockable)

Imports flow **downward only**. A `modules/web` file may **not** import from `modules/mobile` (and vice versa). Cross-module code lives in `modules/bridge` or `shared/`.

### 2.2 Typed IPC contract (Adapter)
`src/shared/ipc/channels.ts` is the single source of truth for the renderer↔main API.

- `CHANNELS` is the string registry (grep-able).
- `IpcContract` pins request/response per channel.
- Renderer calls `window.bridge.invoke(CHANNELS.X, input)` — fully typed end to end.

**When you add a new IPC operation:** edit `channels.ts` first (red), then add the main-side handler in `ipc/register.ts`, then the renderer wrapper in `services/ipc.ts` or a module store. Never add a channel string anywhere else.

### 2.3 Store / Service split (Renderer)
Per-module Zustand store + thin IPC wrapper.

- **Store** = state + actions only. Synchronously testable.
- **Action body** = calls `invoke(CHANNELS.X, ...)`. No IPC string literals.
- **No store talks to another module's store**. Cross-module coordination happens via `modules/bridge` or via the main-process buses.

### 2.4 Event-driven core (Observer / Pub-Sub)
- `VarBus extends EventEmitter` — emits `update` / `clear`.
- `BridgeEventBus extends EventEmitter` — emits `event` and per-channel `<channel>` events.
- IPC `register.ts` wires those EventEmitters to broadcast over `webContents.send(CHANNELS.EVT_*)`.

**When you add an event-emitting operation:** keep the bus pure (no IPC, no fs). The wiring layer in `ipc/register.ts` is what bridges it to the renderer.

### 2.5 Driver = Strategy (swappable)
`src/main/drivers/web/playwright.ts` and `src/main/drivers/mobile/appium.ts` implement a small `WebDriver` / `MobileDriver` interface. A mock implementation must exist so tests and demos run without installing Chromium / Appium. `HERMETRA_DRIVERS=real` selects real drivers; default is mock.

### 2.6 Workspace = Multi-tenancy boundary
Every data file is scoped to `workspaceManager().activeDir()`. Don't read or write outside that path from a service unless the data is genuinely global (browser install state). The Workspace switcher lives in the topbar; switching it triggers `App.tsx` to re-init stores.

### 2.7 i18n (en/ko) as a hard requirement
Every user-facing string must have a key in both `en` and `ko` of `src/renderer/lib/messages.ts`. The `MessageKey` type ensures TypeScript fails on missing keys. **Never hard-code Korean or English strings in components.**

### 2.8 Theme tokens are the only knob for visuals
All colors / radii / shadows come from CSS variables in `src/renderer/styles/global.css` + `tailwind.config.ts`. Do not introduce raw hex/rgb in components. If a color is missing, add a token first.

---

## 3. TDD policy

Hermetra develops test-first. Every new behavior — frontend or backend — starts with a **failing test**.

### 3.1 The five test layers

| Layer                 | Where                                | Runner                  | Why                                                                  |
|-----------------------|--------------------------------------|-------------------------|----------------------------------------------------------------------|
| **Biz logic unit**    | `src/main/bridge/**`, `src/main/services/**` pure logic | Vitest (node env)       | Domain rules. Fastest, run on every save.                            |
| **DB schema**         | `tests/schema/*.test.ts`             | Vitest (node env)       | The JSON shape of `store.json`, `variables/*.json`, workspace files. Catches schema drift. |
| **API (IPC)**         | `tests/api/*.test.ts`                | Vitest (node env)       | Each IPC handler in isolation: dispatch a `CHANNELS.X` invoke, assert output + side effects. |
| **UI component**      | `src/renderer/**/*.test.tsx`         | Vitest + RTL + happy-dom | One component at a time. Mock the IPC layer.                         |
| **E2E**               | `tests/e2e/*.spec.ts`                | Playwright (Electron)    | Real Electron, real renderer. Smoke + a couple golden paths.         |

### 3.2 The TDD loop (mandatory for any new behavior)

1. **Red.** Write the smallest failing test that captures the next increment.
2. **Confirm red.** `npm run test -- --run <file>`; the test must fail for the *expected* reason. (No "fails because the symbol doesn't exist yet" if the test was supposed to assert behavior; bring the type into existence first if needed.)
3. **Green.** Write the minimum code that makes the test pass. Resist scope creep.
4. **Refactor.** Improve names / dedupe / extract. Tests stay green.
5. **Commit.** One logical step, one commit, ideally pointing to one test file.

### 3.3 What "high coverage" means here

We aim for:
- **Domain (bridge/, services/)**: **≥ 95 %** line + branch. These are pure functions with no excuse.
- **IPC handlers (api layer)**: **≥ 85 %**. Each channel has at least a happy path and a failure path.
- **UI components**: **≥ 70 %**. Test behavior, not pixels. (Pixel tests live in Playwright if at all.)
- **E2E**: smoke + the 2–3 golden paths (Web tab open → script run → bus update → mobile pickup). Coverage is meaningless here; what matters is the user flow lights up.

Coverage gates fail CI; don't push under threshold.

### 3.4 Test boundaries

- **Pure logic** (`bridge/`, `services/variables.ts`, helpers): no fs, no fake timers unless asserting time. Inject `Date.now` if needed.
- **IPC handler tests**: use the in-process bus + a fake `webContents` to capture emitted events. Don't spin Electron.
- **UI component tests**: mock `window.bridge.invoke` per test; do not let a component call a real IPC channel.
- **E2E**: real Electron, real renderer, **mock drivers only** (`HERMETRA_DRIVERS=mock`, default). Do not require Playwright/Appium for tests.

### 3.5 No side effects, no flakes

- Tests must be **deterministic**. Use `vi.useFakeTimers()` when asserting timeouts/ordering; restore on teardown.
- Tests must be **idempotent**. Each test writes to a temp dir under `os.tmpdir()`; never to the user's real `~/.hermetra/` or workspace.
- A test that touches the filesystem **must** clean up in `afterEach`.

### 3.6 New feature checklist

For any new behavior, the PR must include:

1. ✅ Failing test added first commit (visible in history)
2. ✅ Implementation commit makes it green
3. ✅ At least one test per affected layer (skip layers that don't apply, justify in PR body)
4. ✅ `npm run check` (typecheck + lint + unit + component + api + schema) green
5. ✅ `npm run test:e2e` smoke green
6. ✅ Coverage thresholds not regressed
7. ✅ i18n: every new user-visible string in both `en` and `ko`

---

## 4. NPM scripts (cheat sheet)

```
npm run dev              # electron-vite dev
npm run build            # electron-vite build
npm run typecheck        # tsc --noEmit (node + web)
npm run lint             # eslint .
npm run test             # vitest run (unit + component + api + schema)
npm run test:watch       # vitest watch
npm run test:coverage    # vitest run --coverage
npm run test:e2e         # playwright test (Electron, mock drivers)
npm run check            # typecheck && lint && test && build
```

`npm run check` is the gate every PR must pass.

---

## 5. Database — what we actually have

There is **no SQL/NoSQL database**. Persistence is plain JSON files, one per workspace, in:

- `<workspaceDir>/store.json` — bookmarks, capabilities, scenarios
- `<workspaceDir>/variables/*.json` — variable profiles (shared + private split)
- `<userData>/workspaces.json` — workspace registry
- In-memory only (no persistence): the `VarBus` and `BridgeEventBus`. Restarting the app empties them. This is intentional — they model *live* state, not history.

If we ever move to SQLite or similar, the **DB Schema** test layer above is where migrations and constraints get covered. Until then, those tests guard the JSON shape (zod-style validation of `store.json` on read; `Schema` versions if we add them).

---

## 6. House rules (small but matters)

- **No emojis** in code, commit messages, or UI strings unless the user explicitly asks.
- **No `// removed` comments**, no `unused_` renames. Delete dead code.
- **No new pages/routes** without an explicit ask.
- **No restructure to mirror a design reference.** If a screenshot is given, change tokens/styles only — see `memory/feedback_redesign_scope.md` for the incident this rule came from.
- **No `--no-verify`, no `--amend` on shared commits**, no force-push to `main`.
- **One feature, one PR.** Don't bundle unrelated cleanup.

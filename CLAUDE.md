# CLAUDE.md — Hermetra working agreement

This file is the durable contract between Claude (and any AI coding agent) and this codebase. **Read it before touching code.** It says how the code is structured, which patterns to follow, and how to write & verify changes.

The companion file `AGENTS.md` defines the same rules for non-Claude agents. Keep them in sync.

---

## 0. The product, in one paragraph

Hermetra is a desktop Electron app that bridges **Web** (Playwright) and **Mobile** (Appium) automation sessions. The differentiator is the **Bridge** layer (labelled "Bridge" / "브리지" in the UI as well): a shared variable bus, a cross-side event bus, and a scenario orchestrator that lets a single ordered scenario span both sides. See `ARCHITECTURE.md` for the long form.

> Note on naming: UI label and internal identifiers now agree — both are **`bridge`**. Routes (`/bridge/*`), IPC channel names (`BRIDGE_*`), module folder (`modules/bridge`) and domain types (`BridgeEvent`, `BridgeSide`) are load-bearing; renaming them churns IPC contracts and tests. The UI label was **"Settings" / "설정"** until 2026-07-29 and was reverted: the group holds this product's actual work (scenarios, variables, shared bus, event stream), and "Settings" reads as a drawer nobody opens.

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

### 3.2 The TDD loop — `tdd_mode: routed`

Tests are never optional. The *order* depends on the layer
(`.harness/steward/config.yaml` → `values.tdd_mode: "routed"`):

| Layer | Order |
|---|---|
| Biz logic (`src/main/bridge/**`, pure `services/**`) | **test first** — no exceptions |
| API / IPC contract (`channels.ts` + handler) | **test first** — the contract is the test |
| Schema (`store.json`, `variables/*.json`, workspace files) | **test first** |
| UI component | test may follow the implementation, but lands in the same change |
| E2E | test may follow the implementation, but lands in the same change |

Test-first layers run the full loop:

1. **Red.** Write the smallest failing test that captures the next increment.
2. **Confirm red.** `npm run test -- --run <file>`; the test must fail for the *expected* reason. (No "fails because the symbol doesn't exist yet" if the test was supposed to assert behavior; bring the type into existence first if needed.)
3. **Green.** Write the minimum code that makes the test pass. Resist scope creep.
4. **Refactor.** Improve names / dedupe / extract. Tests stay green.
5. **Commit.** One logical step, one commit, ideally pointing to one test file.

For UI/E2E, implement → verify by actually driving the app (`ui-preview` binding
— clicking, not just looking) → then write the test that pins the behavior.
Pick layers by what the change touches; don't demand all five.

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

### 3.6 New behavior checklist

There are no PRs here (§6) — this is the bar a change must clear before it is
committed to `main`:

1. ✅ Test-first layers (logic / IPC / schema) show the failing test in the first commit
2. ✅ Implementation commit makes it green
3. ✅ At least one test per affected layer (skip layers that don't apply, justify in the commit message)
4. ✅ `npm run check` (typecheck + lint + test + build) green
5. ✅ `npm run test:e2e` smoke green
6. ✅ Coverage thresholds not regressed
7. ✅ i18n: every new user-visible string in both `en` and `ko`
8. ✅ Canonical docs updated (`docs/spec/`, `docs/qa/`) or "no spec impact" stated explicitly
9. ✅ Gate run recorded in `docs/qa/runs/`, in the same commit as the change

---

## 4. NPM scripts (cheat sheet)

```
npm run dev              # electron-vite dev
npm run build            # electron-vite build
npm run typecheck        # tsc --noEmit (node + web)
npm run lint             # eslint . (flat config in eslint.config.js)
npm run test             # vitest run (unit + component + api + schema)
npm run test:watch       # vitest watch
npm run test:coverage    # vitest run --coverage
npm run test:e2e         # playwright test (Electron, mock drivers)
npm run check            # typecheck && lint && test && build
```

Lint layout mirrors the process boundaries: `src/main` + `src/preload` get Node
globals, `src/renderer` gets browser globals plus `react-hooks` rules, `**/*.cjs`
is parsed as CommonJS. A parameter named `_x` is allowed to be unused (interface
signatures); an unused *variable* is still an error — delete it.

`npm run check` is the gate every PR must pass. steward's `gate` phase runs the
same three commands plus `npm run test:e2e`, then records the run in
`docs/qa/runs/`.

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
- **No `--no-verify`, no `--amend` on published commits**, no force-push to `main`.
- **Work on `main`. Do not create branches.** No `feat/*`, `chore/*`, `docs/*`, no
  PRs. This is a single-developer project; a branch per change is pure overhead
  here. Commit straight to `main` when the user asks for a commit.
- **One logical change, one commit.** Don't bundle unrelated cleanup. This is what
  keeps history reviewable now that there are no PRs.

---

## 7. Workflow — steward is the canonical harness

This project is driven by the **steward** harness (installed as the
`steward@steward` plugin). Its config lives in `.harness/steward/config.yaml`;
the active harness is pinned by the untracked `.harness-main` file.

You do **not** pick a command. steward classifies every request first and shows
the verdict tag on the first line of the reply:

| Tag | When | Phases it runs |
|---|---|---|
| `[consult]` | question / analysis, not a task | none — read-only answer |
| `[direct]` | trivial one-liner | fix → verify → one-line report |
| `[hotfix]` | urgent one-or-two-line fix | build (short) → gate |
| `[small]` | small, clear scope | intake (short) → build → review (1 lens) → gate → report |
| `[feature]` | new behavior | intake → spec → build → review (5 lenses) → gate → report |
| `[greenfield]` | new screen / new service | same as feature, spec depth maximal |

Phase skills: `/steward:intake`, `/steward:spec`, `/steward:build`,
`/steward:review`, `/steward:gate`, `/steward:report`, `/steward:immunize`.
Invoking one manually overrides the automatic verdict. `/steward:guide` explains
the harness itself; `/steward:handover` backfills the canonical docs.

### What lives where

| Thing | Path |
|---|---|
| Living plan spec (Application>Service>Surface>Section>Component) | `docs/spec/` |
| Living test definitions (TestPlan>Scenario>Suite>Case) | `docs/qa/` |
| Gate run records (append-only) | `docs/qa/runs/` |
| Agreed vocabulary | `docs/glossary.md` |
| Per-task batons (intake / build-report / findings / gate-report) | `.harness/steward/artifacts/<work>/` |
| Screenshots and UI verification records | `.harness/steward/artifacts/<work>/shots/`, `surface-verify.json` (both untracked) |
| Past sprint specs of the previous harness | `.specs/done/` (frozen, historical) |

`docs/spec/` and `docs/qa/` are **canonical and present-tense** — they describe
what the product must be now, not what a task did. steward's `gate` phase
compares the diff against them and blocks on unexplained drift.

**Naming the baton without branches.** steward normally derives `<work>` from the
git branch. Since everything happens on `main`, set `feature:` in
`.harness/steward/config.yaml` at the start of any task that runs phases:

```yaml
feature: connection-session-wiring
```

Without it every task writes into the same folder and overwrites the previous
task's baton. Clear the line (or set the next slug) when that task is done; the
finished baton stays as its record. The two commit hooks — the gate and the UI
gate — only arm while that folder exists, so a `[direct]` fix with no baton
commits without ceremony, which is the intent.

### Project values and bindings (`.harness/steward/config.yaml`)

| Slot | Value here |
|---|---|
| `tdd_mode` | `routed` — see §3.2 |
| `typecheck_command` | `npm run typecheck && npm run lint` |
| `test_command` | `npm run test` |
| `build_command` | `npm run build` |
| `e2e-runner` | `npm run test:e2e` |
| `token-guard` | `npm run sweep` (tokens + layered imports + i18n + coverage + ledger) |
| `ui-preview` | `.harness/steward/project/impl/ui-preview.md` (launch Electron, click through) |
| `ui-shot` | `node .harness/steward/project/impl/ui-shot.mjs --nav=<testid>` |
| `surface-verify`, `contrast-check` | `node .harness/steward/project/impl/surface-verify.mjs` |

Verify the wiring any time with `node .harness/steward/core/validate.mjs`.

### The UI gate (`surface-verify`)

Touching `src/renderer/**/*.tsx`, `src/renderer/styles/**/*.css` or
`tailwind.config.ts` arms a commit gate: the hook demands a fresh verification
record and **re-runs the judge itself** rather than trusting a claim of success.

```bash
node .harness/steward/project/impl/surface-verify.mjs              # every screen x 3 widths x 2 themes
node .harness/steward/project/impl/surface-verify.mjs --nav=nav-bridge-bus --form=medium --theme=dark
```

- The **adapter** (`impl/surface-verify.mjs`) launches the built app with mock
  drivers and extracts a normalized model — effective background colour, clipped
  visible bounds, text size, states — into
  `.harness/steward/artifacts/<work>/surface-verify.json`, plus a screenshot
  per capture.
- The **judge** (`impl/surface-checks.mjs`) decides violations from that model
  alone: contrast (WCAG 2.2 SC 1.4.3), overlap, truncation, fits, render errors,
  hit targets. It must stay free of DOM/CSS vocabulary — that is what keeps it
  reusable for another surface. Unit tests: `tests/unit/surface-checks.test.ts`.
- Pre-existing findings live in `.harness/steward/project/surface-baseline.json`
  (237 as of 2026-07-28: contrast on accent buttons/badges, one deliberate URL
  ellipsis, two small targets). They are reported as observations, not blockers —
  a gate that always fails gets ignored. Fix one, delete its line from the
  baseline; never regenerate the whole file to silence a new finding.
- Exit code `2` means **cannot-verify** and is never a pass.

### The previous `.claude` harness (legacy, still useful)

`/intake`, `/quick`, `/sprint`, `/sweep`, `/immunize` and the `testwriter` /
`implementer` / `auditor` / `sweeper` agents predate steward. They are **not**
the default path anymore — don't start work with them. What stays live:

- **PreToolUse hooks** — `design-token-guard`, `immunity-rules-guard` (see below).
- **Sweep scripts** — reached through steward's `token-guard` binding.
- **Immunity ledger** — `/steward:immunize` writes to the same
  `.claude/immunity/ledger.md`, so the hooks keep enforcing it.

### Active immunity rules

Every phase reads `.claude/immunity/ledger.md` before writing code.
Two PreToolUse hooks back this up at the tool-call level:

- **`design-token-guard`** — Blocks Writes/Edits to `.tsx` that reference a
  Tailwind color class not registered in `tailwind.config.ts`. See ledger
  entry `design-token-fabrication`.
- **`immunity-rules-guard`** — For each ledger entry with a `rule:` regex,
  blocks any Write/Edit whose content matches.

If a hook blocks you, do **not** rewrite the content to bypass it. Either use
a valid token / pattern, or update the ledger entry first (via `/immunize`)
if the rule is genuinely wrong.

### Shortcuts

| You want to | Command |
|---|---|
| Run the whole sweep | `npm run sweep` (exits 1 if any check fails; read the summary table) |
| Run one check (e.g. tokens) | `npm run sweep:tokens` |
| Run full project gate | `npm run check` |
| Lint the ledger | `npm run lint:ledger` |
| Preflight readiness | `npm run preflight` |
| Check the steward wiring | `node .harness/steward/core/validate.mjs` |
| Screenshot a screen | `node .harness/steward/project/impl/ui-shot.mjs --nav=nav-bridge-bus` |

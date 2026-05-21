# AGENTS.md — Working agreement for AI coding agents

This file mirrors `CLAUDE.md` and applies to **any** AI coding agent that operates on this repo (Cursor, Aider, Codex, OpenAI agents, etc.). If you are Claude, read `CLAUDE.md`; this file is the same contract restated for tooling that looks for `AGENTS.md` by convention.

Both files must stay in sync. If you change one, change the other.

---

## 1. Read this before you write code

- The product is described in `ARCHITECTURE.md`.
- The architecture and design patterns you must follow are in `CLAUDE.md §1–2`.
- The TDD policy you must follow is in `CLAUDE.md §3`.
- The npm scripts you must run before reporting "done" are in `CLAUDE.md §4`.

---

## 2. Design patterns (must follow)

Restated from `CLAUDE.md §2`. Use what's already there; do not invent parallels.

1. **Layered architecture** — UI (renderer) → Application (main/services + ipc) → Domain (main/bridge) → Infrastructure (main/drivers). Imports flow downward only. `modules/web` and `modules/mobile` may not import each other; cross-module code goes in `modules/bridge` or `shared/`.
2. **Typed IPC contract** — every renderer↔main call is declared once in `src/shared/ipc/channels.ts`. To add a channel: edit `channels.ts` → add handler in `src/main/ipc/register.ts` → add wrapper in renderer module store. Never spread channel strings.
3. **Store / Service split (renderer)** — Zustand stores hold state + actions; actions call `invoke(CHANNELS.X, …)`. Stores never know about other stores' internals.
4. **Event-driven core** — `VarBus` and `BridgeEventBus` are pure `EventEmitter`s with no fs/IPC. The wiring in `ipc/register.ts` is what broadcasts them.
5. **Driver = Strategy** — `WebDriver` / `MobileDriver` are interfaces; real Playwright/Appium implementations are swappable with mocks. Default mode is mock (`HERMETRA_DRIVERS=mock`).
6. **Workspace multi-tenancy** — every data file is scoped under `workspaceManager().activeDir()`. Don't write outside it unless data is genuinely global.
7. **i18n is non-optional** — every user-facing string lives in `messages.ts` under both `en` and `ko`. No hard-coded literals in components.
8. **Theme tokens** — colors / radii / shadows come from CSS variables. No raw hex/rgb in components.

---

## 3. TDD policy (must follow)

Hermetra is developed test-first. **Every behavior change starts with a failing test.**

### 3.1 Five test layers

| Layer                | Where                       | Runner                  |
|----------------------|-----------------------------|-------------------------|
| Biz logic unit       | `tests/unit/**`             | Vitest (node)           |
| DB schema            | `tests/schema/**`           | Vitest (node)           |
| API (IPC handlers)   | `tests/api/**`              | Vitest (node)           |
| UI component         | `src/renderer/**/*.test.tsx`| Vitest + RTL + happy-dom |
| E2E                  | `tests/e2e/**`              | Playwright (Electron)    |

### 3.2 The loop (mandatory)

1. **Red** — write the smallest failing test.
2. **Confirm red** — run it; it must fail for the expected reason.
3. **Green** — minimum code to pass.
4. **Refactor** — improve names/dedupe; tests stay green.
5. **Commit** — one logical step per commit.

### 3.3 Coverage thresholds (CI gate)

- Domain (`src/main/bridge/**`, pure `services/**`): **≥ 95 %** line + branch.
- IPC handlers (`src/main/ipc/**`): **≥ 85 %**.
- UI components: **≥ 70 %**.
- E2E: smoke + 2–3 golden paths.

`npm run test:coverage` enforces; PRs that regress fail CI.

### 3.4 Boundaries

- Pure logic: no fs, no real timers (inject `Date.now` if you need to).
- IPC tests: in-process bus + fake `webContents`; don't boot Electron.
- UI tests: mock `window.bridge.invoke` per test.
- E2E: real Electron + mock drivers only.

### 3.5 No flakes, no side effects

- Deterministic. Use `vi.useFakeTimers()` when timing matters.
- Idempotent. Each test writes to `os.tmpdir()`; never to the user's `~/.hermetra/`.
- Clean up in `afterEach` for any fs/global mutation.

### 3.6 PR / commit checklist

For every behavior change:

- [ ] Failing test added in first commit, visible in history
- [ ] Implementation commit makes it green
- [ ] At least one test per affected layer (skip layers that don't apply; justify)
- [ ] `npm run check` (typecheck + lint + unit + component + api + schema) green
- [ ] `npm run test:e2e` smoke green
- [ ] Coverage thresholds not regressed
- [ ] i18n: every new user-visible string in both `en` and `ko`

---

## 4. House rules

- No emojis in code/commits/UI unless the user explicitly asks.
- No `// removed` comments; delete dead code.
- No new pages/routes without an explicit ask.
- No restructure to mirror a design reference — change tokens/styles only.
- No `--no-verify`, no `--amend` on shared commits, no force-push to `main`.
- One feature, one PR.

---

## 5. The DB (so nobody asks again)

There is no SQL/NoSQL database. JSON files only:

- `<workspaceDir>/store.json` — bookmarks, capabilities, scenarios
- `<workspaceDir>/variables/*.json` — variable profiles
- `<userData>/workspaces.json` — workspace registry
- `VarBus` and `BridgeEventBus` are **in-memory only**; restarting the app clears them by design (they model live state, not history).

If/when this moves to SQLite, the DB Schema test layer is the place for migrations + constraint tests. Until then, those tests guard the JSON shape.

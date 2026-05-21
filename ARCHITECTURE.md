# Hermetra — Architecture

> Hermetra: a **bridge** application that connects **Web** and **Mobile** automation sessions into a single integrated workflow.

The name is intentional: "Hermes" (messenger between worlds) + "tetra" (four — for the four corners: Web/Mobile × Local/Remote). The app's reason for being is *connection* — every architectural decision flows from that.

---

## 1. Goal

The original `qatools/agent` Electron app bundles ten+ feature surfaces (testcase, testsuite, miller, planning, …). Hermetra extracts only the **Web** and **Mobile** surfaces and adds a third citizen — the **Bridge** — whose job is to make those two halves act as one.

In one sentence:
> Hermetra is the smallest possible app where a Web session and a Mobile session can share variables, fire events at each other, and run inside a single ordered scenario.

---

## 2. Top-level shape

```
┌────────────────────────────────────────────────────────────────┐
│  Renderer  (React 19 + Vite + Tailwind v4 + shadcn primitives) │
│                                                                │
│   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│   │ Web Module  │   │ Mobile Module│   │  Bridge Module   │   │
│   │  (pages,    │   │  (pages,     │   │  (Linker UI,     │   │
│   │  stores)    │   │  stores)     │   │  Event Bus UI,   │   │
│   │             │   │              │   │  Scenario Editor)│   │
│   └─────────────┘   └──────────────┘   └──────────────────┘   │
│           ▲                ▲                    ▲             │
│           └────────────────┴────────────────────┘             │
│                          │  IPC (typed)                        │
└──────────────────────────┼─────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Main process  (Electron)                                      │
│                                                                │
│   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│   │ WebDriver   │   │ MobileDriver │   │  BridgeKernel    │   │
│   │ (Playwright)│   │ (Appium)     │   │  - VarBus        │   │
│   │ stub-able   │   │ stub-able    │   │  - EventBus      │   │
│   │             │   │              │   │  - Orchestrator  │   │
│   └──────┬──────┘   └──────┬───────┘   └────────┬─────────┘   │
│          └─────────────────┴────────────────────┘             │
│                       Domain services                          │
└────────────────────────────────────────────────────────────────┘
```

Three deliberate layers, mapped to Electron's process model:

| Layer            | Runs where        | Responsibility                                        |
|------------------|-------------------|-------------------------------------------------------|
| **UI**           | Renderer          | React surfaces, theming, store, IPC consumers         |
| **Application**  | Main (services)   | Drives drivers, scenario orchestration, var/event bus |
| **Infrastructure** | Main (drivers)  | Playwright / Appium adapters; replaceable by mocks    |

The renderer never talks to Playwright or Appium directly. All capability access flows through a **typed IPC contract** in `src/shared/ipc/channels.ts`.

---

## 3. The three modules

### 3.1 Web module
Carries the *essence* of the original three web pages:

- **RemoteBrowser** — start/stop a Playwright Chromium server, manage tabs, drive navigation via URL bookmarks.
- **CodeEditor** — Monaco-backed script workspace bound to `scripts/web/`.
- **Env (Variables)** — profile-scoped Shared / Private variables (Git-safe split).

### 3.2 Mobile module
Mirrors web with Appium-flavored equivalents:

- **Devices** — Appium/ADB/libimobiledevice tooling status, connection capabilities, session actions.
- **CodeEditor** — same Monaco surface, bound to `scripts/mobile/`.
- **Env (Variables)** — reuses the Variables document model (so the *same* profile can drive both web & mobile runs).

### 3.3 Bridge module *(new — this is the differentiator)*

The Bridge is what makes Hermetra different from the source app's split web/mobile pages.

**a) Variable Bus** — Shared Variables are shared across web and mobile sessions in real time. A web script writing `bus.set("orderId", "X-42")` is observable by a concurrent mobile script via `bus.get("orderId")`. The bus is the same `VariablesDocument` model the source app already uses; Hermetra simply exposes a *live* read/write channel over IPC.

**b) Event Bus** — Pub/sub channel for cross-platform handoffs:

```
web.publish("login.completed", { sessionId })
        │
        ▼
mobile.on("login.completed", () => driver.startActivity(...))
```

Channels are namespaced (`web.*`, `mobile.*`, `bridge.*`) and traced in a debug timeline so users can see every cross-side message.

**c) Scenario Orchestrator** — A scenario is an ordered list of steps; each step is `{platform: "web" | "mobile" | "both", scriptPath, waitFor?}`. The orchestrator runs each step in the right driver, blocks on `waitFor` events, and forwards bus state.

```yaml
# example scenario
- platform: web
  script: scripts/web/login.ts
  emits: login.completed
- platform: mobile
  script: scripts/mobile/verify-otp.ts
  waitFor: login.completed
```

---

## 4. Process & IPC model

```
Renderer ──invoke──► Main (service)
Renderer ◄──event── Main (driver event, bus update)
```

- Channels are declared in `shared/ipc/channels.ts` with input/output types — no string typos at call sites.
- Renderer accesses IPC through `window.bridge.<channel>(...)` exposed by the preload script via `contextBridge`. `nodeIntegration` is **off**; `contextIsolation` is **on**.
- Drivers (Playwright, Appium) are **swap-in/swap-out** behind an interface. The default ships with `MockDriver` so the app boots and demos end-to-end without installing browsers or Appium. A flag (`HERMETRA_DRIVERS=real`) switches to the real implementations.

---

## 5. State management

- Per-module **Zustand** stores (`useWebStore`, `useMobileStore`, `useBridgeStore`, `useThemeStore`).
- Stores never call IPC directly; they call **service hooks** in `src/renderer/services/` which wrap IPC. This keeps stores synchronously testable.
- Main-process state is owned by services; the renderer is a projection. Single source of truth lives in main for anything that touches the OS (browser, devices).

---

## 6. UI system

- **Tailwind v4** (`@tailwindcss/vite`) — utility-first, with CSS variables for theme tokens.
- **shadcn-flavored primitives** — Radix headless + local copies, no runtime dependency on a UI kit.
- **`next-themes`** — light / dark / system, persisted to `localStorage`. CSS variables flip on `[data-theme="dark"]`.
- **Layout**: persistent left sidebar (Web / Mobile / Bridge), top app bar with theme toggle and bridge status pill, content slot.
- **Typography**: Inter for UI, JetBrains Mono for code. Both self-hosted via `@fontsource`.

Design language: **flat with soft borders, generous whitespace, status-pill iconography**. Accent rotates by module (web: emerald, mobile: violet, bridge: amber).

---

## 7. Folder layout

```
hermetra/
├── ARCHITECTURE.md              # ← this file
├── package.json
├── electron.vite.config.ts      # Vite config for main, preload, renderer
├── tsconfig*.json
├── tailwind.config.ts
├── index.html
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # app entry, window mgmt
│   │   ├── ipc/                 # channel handlers, one file per domain
│   │   ├── drivers/             # web/, mobile/, mock/
│   │   └── bridge/              # var-bus, event-bus, orchestrator
│   ├── preload/
│   │   └── index.ts             # contextBridge surface
│   ├── shared/
│   │   ├── ipc/channels.ts      # typed channel registry
│   │   └── types/               # cross-process types
│   └── renderer/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes.tsx
│       ├── components/
│       │   ├── ui/              # shadcn primitives
│       │   ├── layout/          # AppShell, Sidebar, Topbar
│       │   └── theme/           # ThemeProvider, ThemeToggle
│       ├── modules/
│       │   ├── web/             # pages + store + service for Web
│       │   ├── mobile/          # pages + store + service for Mobile
│       │   └── bridge/          # pages + store + service for Bridge
│       ├── services/            # IPC wrappers (one per channel group)
│       └── lib/                 # cn(), formatters, hooks
```

The boundary is hard: a `modules/web` file may not import from `modules/mobile` (and vice versa). Anything cross-module **must** live in `modules/bridge` or `shared/`. This is what keeps the Bridge from re-collapsing into a third leaky abstraction.

---

## 8. Stack

| Concern           | Choice                                       | Why                                                                 |
|-------------------|----------------------------------------------|---------------------------------------------------------------------|
| Shell             | Electron 36                                  | Need OS access for Playwright/Appium drivers                        |
| Build             | electron-vite (Vite 6)                       | Fast HMR for renderer + main; tsx + esbuild for main                |
| UI framework      | React 19                                     | Matches source app; concurrent features useful for event-stream UI  |
| Styling           | Tailwind v4 + CSS vars                       | Theme tokens drive light/dark without re-bundling                   |
| Components        | Radix + local shadcn-style primitives        | Accessible, no UI-kit lock-in                                       |
| State             | Zustand                                      | Tiny, no provider tree, easy slice composition                      |
| Code editor       | Monaco (`@monaco-editor/react`)              | Same DX as source app                                               |
| Theme persistence | `next-themes`                                | One-liner, SSR-safe (future renderer-in-browser option)             |
| Icons             | `lucide-react`                               | Consistent with source                                              |
| Web automation    | Playwright (real driver) / Mock (default)    | Mock keeps demo path working without Chromium install               |
| Mobile automation | `webdriverio` + Appium / Mock (default)      | Same — demo path works on any machine                               |

---

## 9. Non-goals (explicit)

So the scope stays honest:

- ❌ TestCase / TestSuite / Miller / Planning / AI Jobs — out of scope; this is a *web+mobile bridge*, not a full QA platform.
- ❌ Multi-user / cloud sync — local-only desktop app.
- ❌ Production-grade Playwright/Appium drivers in v1 — mocks ship; real drivers are a follow-on, behind the same interface.
- ❌ Mobile UI (the renderer is desktop-only). "Mobile" in Hermetra always means *device under test*, never *device running the UI*.

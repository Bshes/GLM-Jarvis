# A.E.O.N. — Worklog

## Project Status
A.E.O.N. is being built as a **Next.js 16 + TypeScript** autonomous AI orchestrator
dashboard (the sandbox cannot run Python/Docker/Neo4j, so the Python spec was
faithfully adapted to this stack). It implements the full cognitive architecture:
PERCEIVE → THINK → ACT → REFLECT loop, multi-agent orchestration, graph + vector
memory, LLM complexity routing, three-tier safety execution, anticipatory
triggers, and real-time WebSocket streaming.

## Completed (Foundation + Backend)
- **Design system** `src/app/globals.css`: dark HUD palette (amber core, emerald
  active, rose danger — NO indigo/blue), grid/radial backgrounds, glow/scanline
  utilities, custom scrollbars, animations (pulse/spin/flicker/stream/dash).
- **Prisma schema** `prisma/schema.prisma`: GraphNode, Edge, Memory (with
  embedding), Agent, Action, LogEntry, SensoryEvent, Trigger, Device, Setting.
  DB pushed + seeded (4 agents, 8 devices, 12 nodes/11 edges, 7 memories,
  4 triggers).
- **Layout** `src/app/layout.tsx`: Geist fonts, dark by default, A.E.O.N. metadata.
- **Lib**: `src/lib/aeon.ts` (types/constants: LOOP_PHASES, PHASE_META, TIER_META),
  `src/lib/zai.ts` (ZAI SDK singleton + chat/chatJSON/webSearch/tts/asr helpers),
  `src/lib/router.ts` (complexity classifier → local vs cloud route),
  `src/lib/embed.ts` (deterministic 128-dim hashed bag-of-words + cosine),
  `src/lib/logger.ts` (DB log + emit to stream service), `src/lib/store.ts`
  (Zustand: snapshot, live stream, phase, actions, confirm modal, dispatch).
- **Mini-service** `mini-services/aeon-stream/index.ts`: socket.io on :3003
  (path "/", browser-facing via gateway), plain-HTTP /emit on :3004 (internal,
  server-to-server). Ring buffer of 200 events, warm replay to new clients.
  RUNNING.
- **API routes** under `src/app/api/aeon/`:
  - `orchestrate` — the brain: PERCEIVE (recall) → THINK (route + LLM JSON plan)
    → ACT (tiered action persist/execute; IoT tier-1 applies device state) →
    REFLECT (store memory). Emits live events at each phase.
  - `status`, `logs`, `agents`, `actions`, `actions/[id]` (confirm/deny gate),
    `iot`, `triggers`, `triggers/evaluate` (anticipatory engine), `events`,
    `memory`, `memory/search` (vector recall), `llm`, `websearch`, `tts`, `asr`,
    `seed`.
- **Frontend infra**: `src/hooks/use-aeon-stream.ts` (socket client, gateway via
  `?XTransformPort=3003`), `src/components/aeon/ui.tsx` (PhasePill, TierBadge,
  StatusDot, timeAgo, agentIcon).

## In Progress (Frontend panels)
- App shell + state store + sticky footer (in progress by orchestrator).
- Core orchestrator visualization, agents, sensory, actions, logs panels (by orchestrator).
- Memory Graph, IoT, Triggers panels (delegated to subagents 6a/6b/6c).

## Conventions for all panel components
- All panels live in `src/components/aeon/`.
- Use the Zustand store: `import { useAeon } from "@/lib/store"`.
- Shared types from `@/lib/aeon`; shared primitives from `@/components/aeon/ui`
  (PhasePill, TierBadge, StatusDot, timeAgo, agentIcon).
- shadcn/ui components are in `@/components/ui/*`.
- Color via CSS vars: `var(--aeon-core)` amber, `var(--aeon-active)` emerald,
  `var(--aeon-warn)` orange, `var(--aeon-danger)` rose. NO indigo/blue.
- API base: all routes under `/api/aeon/*` (relative paths).
- Panels must be responsive (mobile-first) and use the `aeon-scroll` scrollbar class
  for scrollable lists.

## Unresolved / Next
- Build remaining panels, wire into `src/app/page.tsx`, lint, agent-browser verify.

---
Task ID: 6-b
Agent: full-stack-developer (IoT panel)
Task: Built the A.E.O.N. IoT smart-home control panel (`src/components/aeon/iot-panel.tsx`) — a fully interactive, responsive control surface for simulated devices persisted via `/api/aeon/iot`.

Work Log:
- Read worklog + store.ts + aeon.ts + iot route + ui.tsx + globals.css + seed route to lock in conventions (HUD palette, StatusDot, DeviceView shape, JSON-string state, optimistic-then-refresh pattern).
- Defined per-family state types (Light/Thermostat/Lock/Blinds/Speaker/Camera) and a `TYPE_META` map (color + lucide icon + mono label) for HUD color-coding — amber for light/speaker, orange for climate, emerald for locks, rose-plum for blinds, rose for cameras. NO indigo/blue.
- Built `useDeviceControl` hook: optimistic local mutation via `useAeon.setState({ devices })` (bypasses setDevices so `pendingActions` isn't reset), per-device syncing Set, then PATCH `/api/aeon/iot` with `{ id, state }` and a final `refresh()` sync. Plus `batchUpdate` for scenes (parallel Promise.all) and `runScene` with a brief active-scene linger for visual feedback.
- Implemented 5 scene quick-actions (Movie Night, Away, Focus, Sleep, Wake Up) — each `build(devices)` returns a list of `{id, state}` patches filtered by type/room.
- Implemented `ControlShell` (accent strip that glows when device is active, type icon chip, name, mono type label, syncing spinner with AnimatePresence, StatusDot for online/offline, dimmed+disabled when offline) and one control per family: LightControl (Switch + brightness Slider + warm/cool toggle buttons), ThermostatControl (temp stepper 16-28 + mode Select heat/cool/auto/off), LockControl (single tap button with Lock/LockOpen swap + emerald=locked / orange=unlocked), BlindsControl (open% Slider), SpeakerControl (Switch + volume Slider), CameraControl (recording Switch + motion indicator with pulsing Radio icon, DETECTED/CLEAR).
- Wired IoTPanel: header with `Activity` icon, "IoT Control Surface" title, online/total badge + manual Sync button, Scenes row, Separator, then `aeon-scroll` room list. Rooms are memo-grouped + sorted alphabetically; each RoomCard shows room name + "n DEV · m LIVE" badge and a responsive device grid (1 col mobile → 2 col sm → 3 col 2xl). Rooms grid is 1 col → 2 col on 2xl. Empty state shows WifiOff + seed hint.
- Framer Motion used for ControlShell layout/initial/animate (offline dims to 0.45 opacity) and syncing badge transitions. Responsive mobile-first throughout (touch-friendly 7x7 steppers, h-7 switches, wrap-friendly scenes row).
- Lint: `bunx eslint src/components/aeon/iot-panel.tsx` passes clean (0 errors, 0 warnings). Dev.log shows clean compilation; seed → 8 devices → /api/aeon/status returning them, so the panel will have live data.

Stage Summary:
- Artifact: `src/components/aeon/iot-panel.tsx` (single self-contained `"use client"` component, default + named export `IoTPanel`).
- Every control persists via PATCH and reflects in the UI through the optimistic-then-refresh flow; scenes batch-update across devices in parallel.
- Did NOT touch page.tsx, layout.tsx, globals.css, store.ts, or the iot API route. Only created `iot-panel.tsx` as instructed.
- Pre-existing lint error in `triggers-panel.tsx` (AgentIcon created during render) is unrelated to this task and was left untouched.

---
Task ID: 6-a
Agent: full-stack-developer (Memory Graph panel)
Task: Built the Memory Graph panel — an interactive force-directed graph
visualization of A.E.O.N.'s graph memory (GraphNode + Edge) layered with a
vector-memory semantic recall search box. Centerpiece "memory" view in the
HUD dashboard.

Work Log:
- Read worklog.md for conventions; inspected the existing
  /api/aeon/memory route.ts and /api/aeon/memory/search/route.ts to confirm
  the POST contracts (node/edge/memory + vector search). Neither needed
  modification — the existing endpoints already satisfy the panel's needs.
- Inspected lib/aeon.ts (GraphNodeView / EdgeView / MemoryView types),
  lib/store.ts (useAeon: graph, memoryCount, refresh), components/aeon/ui.tsx
  (timeAgo helper), and globals.css (HUD palette + aeon-scroll/aeon-grid-bg/
  aeon-radial-bg/aeon-scanline/aeon-text-glow utilities + animation keyframes).
- Inspected the seed route to confirm a "User" person node exists (for pinning).
- Created src/components/aeon/memory-graph-panel.tsx as a single default-exported
  "use client" component (MemoryGraphPanel).
- Implemented a from-scratch TypeScript force simulation:
  • Coulomb repulsion (O(n²)) between all node pairs
  • Hooke spring attraction along edges (rest length 120px)
  • Centering force toward the SVG centroid
  • Velocity damping + soft bounding walls
  • Cooling alpha that decays from 1 → 0 over ~2.2s (reheats on graph/resize/drag)
  • requestAnimationFrame loop via a loopRef pattern so the latest closure is
    always invoked, with auto-stop when the lattice is at rest
- SVG rendering: nodes are layered (outer halo + mid glow + solid core) colored
  by kind via the aeon palette vars (entity=amber, concept=emerald,
  person=orange, place=rose, event=rose-plum, device=muted gold, agent=lime).
  Edges are dashed lines with mono-font relation labels offset perpendicular
  to the line for legibility. Selected node + its neighbors are highlighted;
  non-neighbors dim to 32% opacity. Pinned "User" node has a spinning dashed
  ring (animate-aeon-spin-slow with transform-box: fill-box).
- Mouse + touch dragging via Pointer Events: setPointerCapture on the SVG,
  pointer-move updates node position directly (skips physics), pointer-up
  releases the node and reheats alpha=0.5.
- Side panel with three Framer Motion-animated tabs (layoutId underline):
  • Nodes: clickable list with kind icons + PIN badge for User; selected node
    detail panel slides open showing summary + relations (clickable to navigate).
  • Add: label Input + kind Select (7 kinds) + summary Input → POST
    /api/aeon/memory {kind:"node",label,nodeKind,summary} then refresh().
  • Recall: query Input + k Select (3/6/10/15) + Recall button → POST
    /api/aeon/memory/search {query,k}; results render with relevance gradient
    bar (active→core), kind badge, source, relative time, and tag chips.
- Header: stat chips for NODES, EDGES, VECTORS (memoryCount) using kind-colored
  inset shadows. HUD corner annotations ("FORCE-DIRECTED LATTICE" + live α).
- Responsive: flex-col on mobile (graph min-h-300px + side panel min-h-260px),
  flex-row on lg (graph flex-1 + side panel w-368px). aeon-scroll class on all
  scrollable lists. touch-none on the SVG to prevent scroll-jacking during drag.
- Lint: 0 errors, 0 warnings in the new file (cleaned 2 unused eslint-disables).
  Dev server compiles the file cleanly.

Stage Summary:
- Artifact: src/components/aeon/memory-graph-panel.tsx (single file, ~820 lines).
- No new API routes needed — reuses existing /api/aeon/memory (GET/POST) and
  /api/aeon/memory/search (POST) as-is.
- No modifications to page.tsx, layout.tsx, globals.css, or store.ts.
- Ready to be imported into src/app/page.tsx by the orchestrator and rendered
  when view === "memory".

---
Task ID: 6-c
Agent: full-stack-developer (Triggers panel)
Task: Built the Anticipatory Triggers panel (`src/components/aeon/triggers-panel.tsx`) — A.E.O.N.'s anticipatory execution contract UI. Operators can browse/arm/disarm/delete triggers, create new triggers (modal), inject simulated sensory events to fire triggers live, run the anticipatory engine, and watch the recent sensory feed.

Work Log:
- Read worklog, `@/lib/aeon` types, `@/lib/store`, `@/components/aeon/ui`, the three API routes (`triggers`, `triggers/evaluate`, `events`), `globals.css`, and the shadcn primitives (Card, Dialog, Select, Switch, Input, Textarea, Label, Separator, sonner).
- Designed a mobile-first responsive layout: HUD header with stat tiles (total / armed / fired / last-1h), a 3-column main grid (trigger list spans 2 cols on lg; right sidebar hosts the sensory injector + recent feed), with `aeon-grid-bg` backdrop and `aeon-scroll` styled scrollbars.
- Implemented `TriggerCard` with channel-color-coded top accent strip, custom `ChannelBadge` (icon + label, color-mix inline styling per channel: biometric→rose, vision→emerald, audio→amber, time→orange, system→muted), `TierBadge`, readably-rendered condition (`metric OP threshold` via `renderCondition` helper), agent glyph, action description, fire count, last-fired relative time, and Switch + delete controls (PATCH/DELETE `/api/aeon/triggers` then `refresh()`).
- Implemented `CreateTriggerDialog` with full form (name/channel/metric/operator/threshold/agentName/action/tier), live contract preview, channel-aware metric datalist suggestions, and POST → `refresh()` → sonner toast on success.
- Implemented `SensoryInjector` (channel/metric/value form, value validated as numeric) that POSTs to `/api/aeon/events`, immediately calls GET `/api/aeon/triggers/evaluate`, then `refresh()`. Toasts the fired triggers (or "no match / cooldown") and tracks fired trigger names in a `recentlyFired` Set for visual highlight.
- Implemented `SensoryFeed` — last 15 observations with severity dot, channel icon, parsed metric+value (from JSON `value` field via `parseSensoryValue` try/catch), channel/severity caption, and relative time.
- Implemented "Run anticipatory check" header button → GET `/api/aeon/triggers/evaluate` → toasts result and highlights fired cards (emerald ring + `animate-aeon-pulse`) for 6 seconds.
- Refactored the agent-icon lookup into a local `AGENT_ICONS_LOCAL` map + `AgentGlyph` component to satisfy `react-hooks/static-components` (function-call-returning-component trips the rule; property access on a stable map doesn't).
- Mounted sonner `<Toaster />` locally inside the panel (with mono-font styling) so toasts render even though the global `layout.tsx` only wires the radix toaster. Did not touch `layout.tsx`/`page.tsx`/`globals.css`/`store.ts`/API routes.
- Lint clean (`bun run lint` → 0 errors in this file; only a pre-existing warning in `use-aeon-stream.ts`).

Stage Summary:
- Artifact: `/home/z/my-project/src/components/aeon/triggers-panel.tsx` — default export `TriggersPanel`, fully typed, responsive, HUD-styled, framer-motion transitions, sonner toasts.
- End-to-end anticipatory loop wired: inject → POST events → GET evaluate → refresh → toast fired triggers + emerald pulse highlight on matching cards. Toggle/delete/create mutations all call `refresh()`.
- No other files modified. Ready to be imported by the orchestrator's app shell via `import TriggersPanel from "@/components/aeon/triggers-panel"`.

---
Task ID: FINAL
Agent: orchestrator (Z.ai Code)
Task: Complete A.E.O.N. frontend, integration, lint, and agent-browser self-verification.

Work Log:
- Built remaining panels: core-view (animated PERCEIVE-THINK-ACT-REFLECT orb + dispatch
  console + live cognition stream), agents-panel (sub-agent roster + dispatch),
  actions-panel (tiered queue + CONFIRMATIVE GATE safety modal), sensory-panel
  (Whisper-style voice ASR + TTS playback + biometric/vision injection + feed),
  logs-terminal (filterable structured log), aeon-shell (status bar, sidebar nav,
  view router, sticky footer, global sonner Toaster).
- Wired Zustand store + socket.io stream hook (gateway via ?XTransformPort=3003).
- Fixed: default vs named export mismatches for subagent panels; `"use client">` typo
  in two files; react-hooks/static-components via AgentGlyph wrapper; removed
  duplicate local sonner Toaster from triggers panel; reactive state selectors.
- Lint: clean (0 errors).
- Agent-browser golden-path verification:
  * Core view renders (animated core, 4 phase nodes, stats, suggestions).
  * Ran T1 directive "Dim the living room to 30% warm" → cycle completed in 4.6s;
    router classified complexity 0.18 → local llama-3.1; IoT agent executed; device
    state actually changed (brightness 30, color warm, color_temperature 2700).
  * Ran T2 directive "Pay the electricity bill" → pending action created; Approve
    opened "CONFIRMATIVE GATE — TIER 2" modal; approved → executed.
  * Anticipatory: injected heart_rate=125 → "Focus-break reminder" T1 trigger fired
    autonomously (no user prompting).
  * All 8 views render without console/runtime errors.
  * Responsive: desktop 1440x900 + mobile 375x812, no horizontal overflow.
  * Sticky footer: gap=0 on short pages, natural push on long pages; header sticky.

Stage Summary:
- A.E.O.N. is fully functional and verified. The cognitive architecture
  (PERCEIVE→THINK→ACT→REFLECT), LLM complexity routing, graph + vector memory,
  three-tier safety execution with human-in-the-loop gate, anticipatory triggers,
  multimodal sensory I/O (ASR/TTS), IoT control, and real-time WebSocket streaming
  all work end-to-end. Stream mini-service running on :3003 (socket.io) + :3004
  (emit). DB seeded. Dev server on :3000, lint clean, no runtime errors.
- Unresolved / next-phase opportunities: richer agent collaboration (agent-to-agent
  messaging), persistent cycle history view, vector memory visualization, real
  vision/VLM image analysis on uploaded camera frames, OAuth-backed multi-user
  operator profiles, and a mobile bottom-nav variant.

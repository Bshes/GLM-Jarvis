# Task 6-c — Triggers panel (full-stack-developer)

## Task
Build the A.E.O.N. Anticipatory Triggers panel at `src/components/aeon/triggers-panel.tsx`.
Reads `useAeon(s => s.triggers)` and `useAeon(s => s.sensory)` plus `refresh()`. Uses
existing API routes:
- GET/POST/PATCH/DELETE `/api/aeon/triggers`
- GET `/api/aeon/triggers/evaluate`
- GET/POST `/api/aeon/events`

## Conventions observed
- HUD styling with amber/emerald/orange/rose palette (NO indigo/blue).
- Use shadcn/ui from `@/components/ui/*`, lucide-react icons, `aeon-scroll` scrollbar.
- Shared primitives `TierBadge`, `agentIcon`, `timeAgo` from `@/components/aeon/ui`.
- Relative API paths only.
- `sonner` for toasts, `framer-motion` for subtle transitions.

## Work Log
- Read worklog, aeon.ts types, store.ts, ui.tsx, all 3 API routes, globals.css.
- Designed 3-column responsive layout: trigger list (left, spans 2 cols on desktop),
  sensory injector + create-trigger dialog (right column), recent sensory feed (bottom).
- Implemented trigger cards with channel color-coding, condition rendering
  (`metric OP threshold`), agent icon, TierBadge, fire count, last-fired relative time,
  enable Switch + delete button.
- Implemented sensory injection form: channel/metric/value, POST `/api/aeon/events`,
  then GET `/api/aeon/triggers/evaluate`, toast fired triggers, highlight recently-fired.
- Implemented "Create trigger" Dialog with full form (name/channel/metric/operator/
  threshold/agentName/action/tier) → POST → refresh.
- Implemented "Run anticipatory check" button calling evaluate endpoint with toast.
- Recent sensory feed list (last 15) with parsed metric+value, severity, relative time.
- Used framer-motion for card mount/exit transitions and pulse highlight on fire.

## Stage Summary
- File: `src/components/aeon/triggers-panel.tsx` — default export `TriggersPanel`.
- End-to-end injection → evaluation → fired-trigger feedback wired via sonner toasts
  and visual pulse highlight on cards whose `lastFired` updated.
- No API routes or shared files modified.

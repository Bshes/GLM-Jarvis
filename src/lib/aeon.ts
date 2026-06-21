/**
 * A.E.O.N. — shared types, constants, and cognitive taxonomy.
 * These mirror the Python spec's cognitive architecture in TypeScript.
 */

export type LoopPhase = "PERCEIVE" | "THINK" | "ACT" | "REFLECT";

export const LOOP_PHASES: LoopPhase[] = ["PERCEIVE", "THINK", "ACT", "REFLECT"];

export const PHASE_META: Record<
  LoopPhase,
  { label: string; color: string; cssVar: string; description: string }
> = {
  PERCEIVE: {
    label: "PERCEIVE",
    color: "var(--aeon-perceive)",
    cssVar: "--aeon-perceive",
    description: "Ingest multimodal sensory data & evaluate against user state",
  },
  THINK: {
    label: "THINK",
    color: "var(--aeon-think)",
    cssVar: "--aeon-think",
    description: "Reason over memory graph, route to model, plan sub-tasks",
  },
  ACT: {
    label: "ACT",
    color: "var(--aeon-act)",
    cssVar: "--aeon-act",
    description: "Dispatch to sub-agents & execute tiered real-world actions",
  },
  REFLECT: {
    label: "REFLECT",
    color: "var(--aeon-reflect)",
    cssVar: "--aeon-reflect",
    description: "Score outcome, update memory, reinforce the loop",
  },
};

/** Safety tiers — the spec's three-tier execution policy. */
export type SafetyTier = 1 | 2 | 3;

export const TIER_META: Record<
  SafetyTier,
  { label: string; name: string; color: string; cssVar: string; behavior: string }
> = {
  1: {
    label: "TIER 1",
    name: "Autonomous",
    color: "var(--aeon-active)",
    cssVar: "--aeon-active",
    behavior: "Execute immediately — smart home, scheduling, recall.",
  },
  2: {
    label: "TIER 2",
    name: "Confirmative",
    color: "var(--aeon-warn)",
    cssVar: "--aeon-warn",
    behavior: "Generate a yes/no confirmation prompt before executing.",
  },
  3: {
    label: "TIER 3",
    name: "Advisory",
    color: "var(--aeon-danger)",
    cssVar: "--aeon-danger",
    behavior: "Output a recommendation only. No side effects.",
  },
};

/** Model routing — local (fast) vs cloud (powerful), per the LiteLLM router spec. */
export type ModelRoute = "local" | "cloud";

export interface RoutingDecision {
  route: ModelRoute;
  complexity: number; // 0..1
  reason: string;
  estTokens: number;
  model: string;
  thinking: boolean;
}

/** Live event streamed over socket.io from the orchestrator. */
export interface AeonEvent {
  id: string;
  ts: number;
  type:
    | "phase"
    | "log"
    | "thought"
    | "action"
    | "memory"
    | "agent"
    | "routing"
    | "sensory"
    | "trigger"
    | "status"
    | "error";
  phase?: LoopPhase;
  level?: "DEBUG" | "INFO" | "WARN" | "ERROR";
  source?: string;
  message?: string;
  data?: unknown;
}

export interface AgentView {
  id: string;
  name: string;
  role: string;
  description: string | null;
  status: string;
  color: string;
  icon: string | null;
  tier: number;
  model: string;
  tasksDone: number;
  lastTask: string | null;
  lastActive: string | null;
}

export interface ActionView {
  id: string;
  title: string;
  description: string | null;
  agentName: string;
  tier: number;
  status: string;
  payload: string | null;
  result: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface LogView {
  id: string;
  level: string;
  source: string;
  phase: string | null;
  message: string;
  createdAt: string;
}

export interface GraphNodeView {
  id: string;
  label: string;
  kind: string;
  summary: string | null;
}

export interface EdgeView {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  weight: number;
}

export interface MemoryView {
  id: string;
  content: string;
  kind: string;
  tags: string | null;
  source: string | null;
  importance: number;
  createdAt: string;
  score?: number;
}

export interface DeviceView {
  id: string;
  name: string;
  room: string;
  type: string;
  state: string;
  online: boolean;
}

export interface TriggerView {
  id: string;
  name: string;
  channel: string;
  metric: string;
  operator: string;
  threshold: string;
  agentName: string;
  action: string;
  tier: number;
  enabled: boolean;
  lastFired: string | null;
  fireCount: number;
}

export interface SensoryEventView {
  id: string;
  channel: string;
  value: string;
  severity: string;
  createdAt: string;
}

/** The full result of one orchestration cycle, returned by /api/aeon/orchestrate. */
export interface OrchestrationResult {
  cycleId: string;
  perception: string;
  routing: RoutingDecision;
  thought: string;
  actions: ActionView[];
  reflection: string;
  memoriesCreated: number;
  durationMs: number;
}

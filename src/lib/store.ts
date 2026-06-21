/**
 * A.E.O.N. global state (Zustand).
 * Holds the system snapshot, the live event stream, the cognitive phase, and
 * all mutate helpers. The socket hook feeds events into this store.
 */
import { create } from "zustand";
import type {
  AeonEvent,
  AgentView,
  ActionView,
  LogView,
  DeviceView,
  TriggerView,
  GraphNodeView,
  EdgeView,
  SensoryEventView,
  LoopPhase,
  OrchestrationResult,
} from "@/lib/aeon";

export type View =
  | "core"
  | "agents"
  | "memory"
  | "sensory"
  | "actions"
  | "logs"
  | "triggers"
  | "iot";

export interface StatusSnapshot {
  agents: AgentView[];
  actions: ActionView[];
  logs: LogView[];
  devices: DeviceView[];
  triggers: TriggerView[];
  graph: { nodes: GraphNodeView[]; edges: EdgeView[] };
  memoryCount: number;
  events: SensoryEventView[];
  pendingActions: number;
  ts: number;
}

const STREAM_CAP = 160;

interface AeonStore {
  view: View;
  setView: (v: View) => void;

  connected: boolean;
  setConnected: (b: boolean) => void;

  bootstrapped: boolean;
  status: StatusSnapshot | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;

  orchestrating: boolean;
  setOrchestrating: (b: boolean) => void;

  phase: LoopPhase | null;
  setPhase: (p: LoopPhase | null) => void;

  stream: AeonEvent[];
  pushEvent: (e: AeonEvent) => void;
  pushEvents: (es: AeonEvent[]) => void;
  clearStream: () => void;

  logs: LogView[];
  actions: ActionView[];
  agents: AgentView[];
  devices: DeviceView[];
  triggers: TriggerView[];
  graph: { nodes: GraphNodeView[]; edges: EdgeView[] };
  sensory: SensoryEventView[];
  memoryCount: number;
  pendingActions: number;

  setAgents: (a: AgentView[]) => void;
  setActions: (a: ActionView[]) => void;
  setLogs: (l: LogView[]) => void;
  setDevices: (d: DeviceView[]) => void;
  setTriggers: (t: TriggerView[]) => void;
  setGraph: (g: { nodes: GraphNodeView[]; edges: EdgeView[] }) => void;
  setSensory: (e: SensoryEventView[]) => void;
  setMemoryCount: (n: number) => void;
  setPendingActions: (n: number) => void;

  confirmAction: ActionView | null;
  openConfirm: (a: ActionView) => void;
  closeConfirm: () => void;

  dispatch: (input: string, context?: string) => Promise<OrchestrationResult | null>;
  refreshActions: () => Promise<void>;
  resolveAction: (id: string, decision: "approved" | "denied") => Promise<void>;
}

export const useAeon = create<AeonStore>((set, get) => ({
  view: "core",
  setView: (v) => set({ view: v }),

  connected: false,
  setConnected: (b) => set({ connected: b }),

  bootstrapped: false,
  status: null,
  bootstrap: async () => {
    const res = await fetch("/api/aeon/status");
    const data = (await res.json()) as StatusSnapshot;
    set({
      status: data,
      bootstrapped: true,
      agents: data.agents,
      actions: data.actions,
      logs: data.logs,
      devices: data.devices,
      triggers: data.triggers,
      graph: data.graph,
      sensory: data.events,
      memoryCount: data.memoryCount,
      pendingActions: data.pendingActions,
    });
  },
  refresh: async () => {
    const res = await fetch("/api/aeon/status");
    const data = (await res.json()) as StatusSnapshot;
    set({
      status: data,
      agents: data.agents,
      actions: data.actions,
      logs: data.logs,
      devices: data.devices,
      triggers: data.triggers,
      graph: data.graph,
      sensory: data.events,
      memoryCount: data.memoryCount,
      pendingActions: data.pendingActions,
    });
  },

  orchestrating: false,
  setOrchestrating: (b) => set({ orchestrating: b }),

  phase: null,
  setPhase: (p) => set({ phase: p }),

  stream: [],
  pushEvent: (e) =>
    set((s) => {
      const next = [e, ...s.stream];
      if (next.length > STREAM_CAP) next.length = STREAM_CAP;
      // Derive side-effects from the event.
      let logs = s.logs;
      let actions = s.actions;
      let agents = s.agents;
      let phase = s.phase;
      let pendingActions = s.pendingActions;

      if (e.type === "log" && e.message) {
        logs = [
          {
            id: e.id ?? Math.random().toString(36).slice(2),
            level: e.level ?? "INFO",
            source: e.source ?? "system",
            phase: e.phase ?? null,
            message: e.message,
            createdAt: new Date(e.ts).toISOString(),
          },
          ...logs,
        ].slice(0, 120);
      }
      if (e.type === "phase" && e.phase) phase = e.phase;
      if (e.type === "action" && e.data && typeof e.data === "object") {
        const d = e.data as { id?: string; status?: string; title?: string; agent?: string; tier?: number; result?: string };
        if (d.id) {
          const existing = actions.find((a) => a.id === d.id);
          if (existing) {
            actions = actions.map((a) =>
              a.id === d.id ? { ...a, status: d.status ?? a.status } : a,
            );
          } else {
            actions = [
              {
                id: d.id,
                title: d.title ?? e.message ?? "action",
                description: null,
                agentName: d.agent ?? "system",
                tier: d.tier ?? 2,
                status: d.status ?? "pending",
                payload: null,
                result: d.result ?? null,
                createdAt: new Date(e.ts).toISOString(),
                resolvedAt: null,
              },
              ...actions,
            ].slice(0, 60);
          }
          pendingActions = actions.filter((a) => a.status === "pending").length;
        }
      }
      if (e.type === "agent" && e.data && typeof e.data === "object") {
        const d = e.data as { agent?: string; status?: string };
        if (d.agent) {
          agents = agents.map((a) =>
            a.name === d.agent ? { ...a, status: d.status ?? a.status } : a,
          );
        }
      }
      return { stream: next, logs, actions, agents, phase, pendingActions };
    }),
  pushEvents: (es) =>
    set((s) => {
      const next = [...es.reverse(), ...s.stream];
      if (next.length > STREAM_CAP) next.length = STREAM_CAP;
      return { stream: next };
    }),
  clearStream: () => set({ stream: [] }),

  logs: [],
  actions: [],
  agents: [],
  devices: [],
  triggers: [],
  graph: { nodes: [], edges: [] },
  sensory: [],
  memoryCount: 0,
  pendingActions: 0,

  setAgents: (a) => set({ agents: a }),
  setActions: (a) => set({ actions: a, pendingActions: a.filter((x) => x.status === "pending").length }),
  setLogs: (l) => set({ logs: l }),
  setDevices: (d) => set({ devices: d }),
  setTriggers: (t) => set({ triggers: t }),
  setGraph: (g) => set({ graph: g }),
  setSensory: (e) => set({ sensory: e }),
  setMemoryCount: (n) => set({ memoryCount: n }),
  setPendingActions: (n) => set({ pendingActions: n }),

  confirmAction: null,
  openConfirm: (a) => set({ confirmAction: a }),
  closeConfirm: () => set({ confirmAction: null }),

  dispatch: async (input, context) => {
    set({ orchestrating: true, phase: "PERCEIVE" });
    try {
      const res = await fetch("/api/aeon/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, context }),
      });
      const result = (await res.json()) as OrchestrationResult;
      // Refresh derived data after a cycle.
      await get().refresh();
      return result;
    } catch (e) {
      console.error("dispatch failed", e);
      return null;
    } finally {
      set({ orchestrating: false, phase: null });
    }
  },

  refreshActions: async () => {
    const res = await fetch("/api/aeon/actions?take=60");
    const data = (await res.json()) as ActionView[];
    get().setActions(data);
  },

  resolveAction: async (id, decision) => {
    await fetch(`/api/aeon/actions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await get().refresh();
    get().closeConfirm();
  },
}));

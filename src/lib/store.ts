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
  RoutingDecision,
} from "@/lib/aeon";

export type View =
  | "core"
  | "agents"
  | "memory"
  | "sensory"
  | "actions"
  | "logs"
  | "triggers"
  | "iot"
  | "console"
  | "settings";

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

export interface CycleHistoryView {
  id: string;
  cycleId: string;
  input: string;
  perception: string;
  thought: string;
  reflection: string;
  routing: RoutingDecision | null;
  route: string;
  complexity: number;
  model: string;
  thinking: boolean;
  durationMs: number;
  actionCount: number;
  memoriesCreated: number;
  outcome: string;
  createdAt: string;
}

export interface ChatTurnView {
  id: string;
  role: "user" | "assistant";
  content: string;
  routing: RoutingDecision | null;
  webResults: { url: string; name: string; snippet: string; host_name: string }[] | null;
  durationMs: number | null;
  createdAt: string;
}

export type AgentMessageKind = "delegate" | "status" | "result" | "query" | "response";

/** A row on the inter-agent collaboration bus. */
export interface AgentMessageView {
  id: string;
  fromAgent: string;
  toAgent: string; // specific agent name, or "broadcast"
  kind: AgentMessageKind;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
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

  // Command palette (⌘K).
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (b: boolean) => void;

  // Shortcut help overlay (?).
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: (b: boolean) => void;

  // Cycle history (persistent timeline).
  cycles: CycleHistoryView[];
  refreshCycles: () => Promise<void>;
  selectedCycle: CycleHistoryView | null;
  selectCycle: (c: CycleHistoryView | null) => void;

  // Direct LLM console.
  chat: ChatTurnView[];
  chatLoading: boolean;
  refreshChat: () => Promise<void>;
  sendChat: (message: string, opts: { useHistory: boolean; useWebSearch: boolean }) => Promise<void>;

  // Inter-agent message bus.
  agentMessages: AgentMessageView[];
  refreshAgentMessages: () => Promise<void>;
  sendAgentMessage: (
    from: string,
    to: string,
    kind: AgentMessageKind,
    subject: string,
    body: string,
  ) => Promise<void>;

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
    // Side-load cycle history (non-blocking).
    void get().refreshCycles();
    // Side-load agent-to-agent message bus (non-blocking).
    void get().refreshAgentMessages();
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

  commandPaletteOpen: false,
  setCommandPaletteOpen: (b) => set({ commandPaletteOpen: b }),

  shortcutHelpOpen: false,
  setShortcutHelpOpen: (b) => set({ shortcutHelpOpen: b }),

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
      void get().refreshCycles();
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

  // ─── Cycle history ───
  cycles: [],
  refreshCycles: async () => {
    try {
      const res = await fetch("/api/aeon/cycles?take=30");
      const data = (await res.json()) as CycleHistoryView[];
      set({ cycles: data });
    } catch {
      /* ignore */
    }
  },
  selectedCycle: null,
  selectCycle: (c) => set({ selectedCycle: c }),

  // ─── Direct LLM console ───
  chat: [],
  chatLoading: false,
  refreshChat: async () => {
    try {
      const res = await fetch("/api/aeon/chat");
      const data = (await res.json()) as ChatTurnView[];
      set({ chat: data });
    } catch {
      /* ignore */
    }
  },
  sendChat: async (message, opts) => {
    set({ chatLoading: true });
    try {
      const res = await fetch("/api/aeon/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, useHistory: opts.useHistory, useWebSearch: opts.useWebSearch }),
      });
      const data = (await res.json()) as {
        response: string;
        routing: RoutingDecision;
        durationMs: number;
        webResults?: { url: string; name: string; snippet: string; host_name: string }[];
      };
      // Optimistically append both turns to the local chat.
      set((s) => ({
        chat: [
          ...s.chat,
          {
            id: `tmp-${Date.now()}-u`,
            role: "user" as const,
            content: message,
            routing: data.routing,
            webResults: data.webResults ?? null,
            durationMs: null,
            createdAt: new Date().toISOString(),
          },
          {
            id: `tmp-${Date.now()}-a`,
            role: "assistant" as const,
            content: data.response,
            routing: null,
            webResults: null,
            durationMs: data.durationMs,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } catch (e) {
      console.error("chat failed", e);
    } finally {
      set({ chatLoading: false });
    }
  },

  // ─── Inter-agent message bus ───
  agentMessages: [],
  refreshAgentMessages: async () => {
    try {
      const res = await fetch("/api/aeon/agents/messages?take=50");
      const data = (await res.json()) as AgentMessageView[];
      set({ agentMessages: data });
    } catch {
      /* ignore */
    }
  },
  sendAgentMessage: async (from, to, kind, subject, body) => {
    // Optimistic insert so the operator sees their send immediately.
    const optimistic: AgentMessageView = {
      id: `tmp-${Date.now()}`,
      fromAgent: from,
      toAgent: to,
      kind,
      subject,
      body,
      read: true,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ agentMessages: [optimistic, ...s.agentMessages] }));
    try {
      await fetch("/api/aeon/agents/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromAgent: from, toAgent: to, kind, subject, body }),
      });
      // Server may schedule a simulated response — refresh shortly after.
      setTimeout(() => {
        void get().refreshAgentMessages();
      }, 1800);
    } catch (e) {
      console.error("sendAgentMessage failed", e);
    }
  },
}));
